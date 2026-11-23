import { Suspense } from "react";
import type { Metadata } from "next";
import { exigirClave } from "@/lib/admin/acceso";
import { NavAdmin } from "./componentes";

// El panel nunca se indexa, ni siquiera en producción.
export const metadata: Metadata = {
  title: "Panel FanBase",
  robots: { index: false, follow: false },
};

export default function LayoutAdmin({ children, params }: LayoutProps<"/admin/[clave]">) {
  return (
    <Suspense fallback={<p className="app adm-cargando">Cargando…</p>}>
      <Marco params={params}>{children}</Marco>
    </Suspense>
  );
}

// Con un link equivocado no se muestra nada del panel: "página no encontrada".
async function Marco({ children, params }: { children: React.ReactNode; params: Promise<{ clave: string }> }) {
  exigirClave((await params).clave);
  return (
    <>
      <header>
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark">F</div>
            <div>
              FANBASE
              <small>Panel de administración</small>
            </div>
          </div>
          <NavAdmin />
        </div>
      </header>
      <main className="app adm">{children}</main>
    </>
  );
}
