import { notFound, redirect } from "next/navigation";
import { claveValida } from "@/lib/admin/acceso";
import { usuarioActual } from "@/lib/admin/sesion";
import { FormularioIngreso } from "./formulario";

// Ingreso al panel. Solo existe bajo el link secreto: con otro link, "no encontrada".
export default async function Entrar({ params }: PageProps<"/admin/[clave]/entrar">) {
  const { clave } = await params;
  if (!claveValida(clave)) notFound();
  if (await usuarioActual()) redirect(`/admin/${clave}`);
  return (
    <main className="adm-entrar">
      <div className="brand">
        <div className="brand-mark">F</div>
        <div>
          FANBASE
          <small>Panel de administración</small>
        </div>
      </div>
      <h1>Ingresar</h1>
      <FormularioIngreso clave={clave} />
    </main>
  );
}

// Como el resto del panel: depende del link y de la sesión, se arma al pedirla.
export const instant = false;
