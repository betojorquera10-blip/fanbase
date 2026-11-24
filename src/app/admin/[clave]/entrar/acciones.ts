"use server";

import { redirect } from "next/navigation";
import { claveValida } from "@/lib/admin/acceso";
import { ingresar } from "@/lib/admin/sesion";

export interface EstadoIngreso {
  error?: string;
}

export async function ingresarAccion(clave: string, _previo: EstadoIngreso, formData: FormData): Promise<EstadoIngreso> {
  if (!claveValida(clave)) throw new Error("Link de administración no válido.");
  const usuario = String(formData.get("usuario") ?? "").slice(0, 100);
  const contrasena = String(formData.get("contrasena") ?? "").slice(0, 200);
  if (!usuario || !contrasena) return { error: "Escribe tu usuario y tu contraseña." };
  const r = await ingresar(usuario, contrasena);
  if (!r.ok) return { error: r.error };
  redirect(`/admin/${clave}`);
}
