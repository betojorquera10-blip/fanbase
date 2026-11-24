// Sesiones del panel de administración.
//
// Dos candados: el link secreto (acceso.ts), que esconde el panel y su página
// de ingreso, y una cuenta con usuario y contraseña. Al entrar, el navegador
// recibe una cookie con un código al azar; la base guarda solo su huella, con
// fecha de vencimiento. Salir borra la sesión de la base.
//
// Cada página y cada acción del panel revisa la sesión por su cuenta: una
// acción se puede llamar directamente, sin pasar por la página.

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { claveValida } from "./acceso";
import { claveCorrecta } from "./claves";

const COOKIE = "fanbase_admin";
const DURACION_DIAS = 14;
const INTENTOS_ANTES_DE_BLOQUEAR = 5;
const MINUTOS_BLOQUEO = 15;

export interface UsuarioAdmin {
  id: number;
  usuario: string;
  nombre: string;
}

const huella = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

// Una huella cualquiera, para tardar lo mismo cuando el usuario no existe
// (así no se puede averiguar qué usuarios existen midiendo el tiempo).
const HUELLA_FALSA = "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

// Quién tiene la sesión abierta en esta visita (o null). Se consulta una vez
// por visita aunque la pidan el marco y la página.
export const usuarioActual = cache(async (): Promise<UsuarioAdmin | null> => {
  const codigo = (await cookies()).get(COOKIE)?.value;
  if (!codigo) return null;
  const sesion = await prisma.adminSesion.findUnique({
    where: { id: huella(codigo) },
    include: { usuario: { select: { id: true, usuario: true, nombre: true, activo: true } } },
  });
  if (!sesion || sesion.expiraEn < new Date() || !sesion.usuario.activo) return null;
  const { id, usuario, nombre } = sesion.usuario;
  return { id, usuario, nombre };
});

// Para las páginas: link equivocado → "no encontrada"; sin sesión → a ingresar.
export async function exigirSesion(clave: string): Promise<UsuarioAdmin> {
  if (!claveValida(clave)) notFound();
  const usuario = await usuarioActual();
  if (!usuario) redirect(`/admin/${clave}/entrar`);
  return usuario;
}

// Para las acciones: falla sin mostrar nada.
export async function revisarSesion(clave: string): Promise<UsuarioAdmin> {
  if (!claveValida(clave)) throw new Error("Link de administración no válido.");
  const usuario = await usuarioActual();
  if (!usuario) throw new Error("Tu sesión terminó. Recarga la página e ingresa de nuevo.");
  return usuario;
}

export type ResultadoIngreso = { ok: true } | { ok: false; error: string };

export async function ingresar(usuarioTexto: string, clave: string): Promise<ResultadoIngreso> {
  const malo: ResultadoIngreso = { ok: false, error: "Usuario o contraseña incorrectos." };
  const usuario = await prisma.adminUsuario.findUnique({ where: { usuario: usuarioTexto.trim().toLowerCase() } });

  if (!usuario || !usuario.activo) {
    await claveCorrecta(clave, HUELLA_FALSA);
    return malo;
  }
  const ahora = new Date();
  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
    const minutos = Math.ceil((usuario.bloqueadoHasta.getTime() - ahora.getTime()) / 60_000);
    return { ok: false, error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} min.` };
  }

  if (!(await claveCorrecta(clave, usuario.claveHash))) {
    const intentos = usuario.intentosFallidos + 1;
    const bloquear = intentos >= INTENTOS_ANTES_DE_BLOQUEAR;
    await prisma.adminUsuario.update({
      where: { id: usuario.id },
      data: {
        intentosFallidos: bloquear ? 0 : intentos,
        bloqueadoHasta: bloquear ? new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60_000) : null,
      },
    });
    return bloquear
      ? { ok: false, error: `Demasiados intentos fallidos. Intenta de nuevo en ${MINUTOS_BLOQUEO} min.` }
      : malo;
  }

  const codigo = randomBytes(32).toString("base64url");
  const expiraEn = new Date(ahora.getTime() + DURACION_DIAS * 86_400_000);
  await prisma.$transaction([
    prisma.adminSesion.create({ data: { id: huella(codigo), usuarioId: usuario.id, expiraEn } }),
    prisma.adminUsuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoIngresoEn: ahora },
    }),
    // De paso, se limpian las sesiones vencidas.
    prisma.adminSesion.deleteMany({ where: { expiraEn: { lt: ahora } } }),
  ]);
  (await cookies()).set(COOKIE, codigo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    expires: expiraEn,
  });
  return { ok: true };
}

export async function salir(): Promise<void> {
  const almacen = await cookies();
  const codigo = almacen.get(COOKIE)?.value;
  if (codigo) await prisma.adminSesion.deleteMany({ where: { id: huella(codigo) } });
  almacen.set(COOKIE, "", { path: "/admin", maxAge: 0 });
}
