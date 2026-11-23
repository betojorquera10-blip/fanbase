import { exigirClave } from "@/lib/admin/acceso";
import { generosConocidos, lugaresConocidos } from "@/lib/admin/manuales";
import { EVENTO_VACIO } from "@/lib/admin/opciones";
import { FormularioEvento } from "../formulario-evento";

export default async function NuevoEvento({ params }: PageProps<"/admin/[clave]/eventos/nuevo">) {
  exigirClave((await params).clave);
  const [generos, lugares] = await Promise.all([generosConocidos(), lugaresConocidos()]);
  return (
    <>
      <section className="adm-titulo">
        <h1>Nuevo evento</h1>
        <p className="muted">Los campos con * son obligatorios.</p>
      </section>
      <FormularioEvento inicial={EVENTO_VACIO} grupo={null} generos={generos} lugares={lugares} />
    </>
  );
}

// Herramienta interna: puede esperar a la base de datos al cargar.
export const instant = false;
