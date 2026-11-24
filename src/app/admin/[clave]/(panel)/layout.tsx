import { Suspense } from "react";
import { exigirSesion } from "@/lib/admin/sesion";
import { salirAccion } from "./acciones";
import { NavAdmin } from "./componentes";

// Todo lo que está dentro de (panel) exige haber ingresado. Las páginas lo
// vuelven a revisar por su cuenta: al navegar dentro del panel el marco no se
// vuelve a dibujar, así que no basta con revisarlo acá.
export default function LayoutPanel({ children, params }: LayoutProps<"/admin/[clave]">) {
  return (
    <Suspense fallback={<p className="app adm-cargando">Cargando…</p>}>
      <Marco params={params}>{children}</Marco>
    </Suspense>
  );
}

// Link equivocado → "página no encontrada"; sin sesión → página de ingreso.
async function Marco({ children, params }: { children: React.ReactNode; params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  const usuario = await exigirSesion(clave);
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
          <form action={salirAccion.bind(null, clave)} className="adm-sesion">
            <span className="muted">{usuario.nombre}</span>
            <button className="adm-link">Salir</button>
          </form>
        </div>
      </header>
      <main className="app adm">{children}</main>
    </>
  );
}
