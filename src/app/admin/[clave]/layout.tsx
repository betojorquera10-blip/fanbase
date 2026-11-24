import { Suspense } from "react";
import type { Metadata } from "next";

// El panel nunca se indexa, ni siquiera en producción.
export const metadata: Metadata = {
  title: "Panel FanBase",
  robots: { index: false, follow: false },
};

// Envuelve la página de ingreso (entrar/) y el panel ((panel)/, que exige sesión).
export default function LayoutAdmin({ children }: LayoutProps<"/admin/[clave]">) {
  return <Suspense fallback={<p className="app adm-cargando">Cargando…</p>}>{children}</Suspense>;
}
