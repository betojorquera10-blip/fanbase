// Primer candado del panel de administración: el "link secreto". El panel y su
// página de ingreso viven en /admin/<FANBASE_ADMIN_LINK> y cualquier otra
// dirección responde "página no encontrada", así los bots ni siquiera llegan a
// probar contraseñas. El segundo candado es la cuenta (sesion.ts).
//
// El link no puede ir escrito en el código porque el repositorio es público:
// se define en el .env (y en Netlify). Sin esa variable el panel no existe.

import { timingSafeEqual } from "node:crypto";
import { notFound } from "next/navigation";

export function claveValida(clave: string): boolean {
  const esperada = process.env.FANBASE_ADMIN_LINK ?? "";
  if (esperada.length < 16) return false; // sin link configurado (o demasiado corto), no hay panel
  const a = Buffer.from(clave);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Para páginas y acciones: si el link no es el correcto, "página no encontrada".
export function exigirClave(clave: string): void {
  if (!claveValida(clave)) notFound();
}
