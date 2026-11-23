"use server";

// Acciones del panel de administración. Cada una revisa el link secreto: una
// acción se puede llamar directamente, sin pasar por la página.

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { claveValida } from "@/lib/admin/acceso";
import {
  borrarEvento, borrarLocal, cambiarVisibilidadEvento, cambiarVisibilidadLocal, guardarEvento, guardarFoto, guardarFuente,
  guardarLocal, validarEvento, validarLocal, type DatosEvento, type DatosLocal, type Errores,
} from "@/lib/admin/manuales";

export interface Estado {
  errores: Errores;
  ok?: string;
}

function revisar(clave: string) {
  if (!claveValida(clave)) throw new Error("Link de administración no válido.");
}

// El sitio guarda la cartelera unos minutos; tras un cambio se refresca al tiro.
const refrescarSitio = () => updateTag("cartelera");

function leerJson<T>(formData: FormData): T | null {
  try {
    return JSON.parse(String(formData.get("datos") ?? "")) as T;
  } catch {
    return null;
  }
}

// ── Eventos ──

export async function guardarEventoAccion(clave: string, grupo: string | null, _previo: Estado, formData: FormData): Promise<Estado> {
  revisar(clave);
  const datos = leerJson<DatosEvento>(formData);
  if (!datos) return { errores: ["No se pudo leer el formulario. Recarga la página e intenta de nuevo."] };
  const errores = validarEvento(datos);
  if (errores.length) return { errores };
  await guardarEvento(datos, grupo ?? undefined);
  refrescarSitio();
  redirect(`/admin/${clave}/eventos?listo=${grupo ? "editado" : "creado"}`);
}

export async function visibilidadEventoAccion(clave: string, grupo: string, visible: boolean) {
  revisar(clave);
  await cambiarVisibilidadEvento(grupo, visible);
  refrescarSitio();
}

export async function borrarEventoAccion(clave: string, grupo: string) {
  revisar(clave);
  await borrarEvento(grupo);
  refrescarSitio();
}

// ── Locales ──

export async function guardarLocalAccion(clave: string, id: number | null, _previo: Estado, formData: FormData): Promise<Estado> {
  revisar(clave);
  const datos = leerJson<DatosLocal>(formData);
  if (!datos) return { errores: ["No se pudo leer el formulario. Recarga la página e intenta de nuevo."] };
  const errores = validarLocal(datos);
  if (errores.length) return { errores };
  await guardarLocal(datos, id ?? undefined);
  refrescarSitio();
  redirect(`/admin/${clave}/locales?listo=${id ? "editado" : "creado"}`);
}

export async function visibilidadLocalAccion(clave: string, id: number, visible: boolean) {
  revisar(clave);
  await cambiarVisibilidadLocal(id, visible);
  refrescarSitio();
}

export async function borrarLocalAccion(clave: string, id: number) {
  revisar(clave);
  await borrarLocal(id);
  refrescarSitio();
}

// ── Fotos ──

export async function subirFotoAccion(clave: string, formData: FormData): Promise<{ url?: string; error?: string }> {
  revisar(clave);
  const archivo = formData.get("foto");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "No llegó ninguna foto." };
  try {
    return { url: await guardarFoto(archivo) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo guardar la foto." };
  }
}

// ── Fuentes ──

export async function guardarFuenteAccion(clave: string, id: string, _previo: Estado, formData: FormData): Promise<Estado> {
  revisar(clave);
  const errores = await guardarFuente(id, {
    activa: formData.get("activa") === "on",
    horasEntreListados: Number(formData.get("horas")),
    diasDelMes: String(formData.get("dias") ?? "").trim() || null,
  });
  return errores.length ? { errores } : { errores: [], ok: "Guardado" };
}
