"use client";

import { useActionState } from "react";
import { ingresarAccion, type EstadoIngreso } from "./acciones";

export function FormularioIngreso({ clave }: { clave: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoIngreso, FormData>(ingresarAccion.bind(null, clave), {});
  return (
    <form action={accion}>
      <label className="adm-campo">
        <span>Usuario</span>
        <input name="usuario" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
      </label>
      <label className="adm-campo">
        <span>Contraseña</span>
        <input name="contrasena" type="password" autoComplete="current-password" required />
      </label>
      {estado.error && !pendiente && <p className="adm-error-texto" role="alert">{estado.error}</p>}
      <button className="primary" disabled={pendiente}>{pendiente ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
