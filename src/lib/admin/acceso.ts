// Acceso al panel de administración por "link secreto", sin usuario ni clave:
// el panel vive en /admin/<FANBASE_ADMIN_LINK> y cualquier otra dirección
// responde "página no encontrada". Pensado para la etapa de pruebas con pocas
// personas; antes de usarlo en producción hay que agregar inicio de sesión.
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
