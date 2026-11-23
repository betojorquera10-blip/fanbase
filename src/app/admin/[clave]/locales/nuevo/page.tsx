import { exigirClave } from "@/lib/admin/acceso";
import { generosConocidos } from "@/lib/admin/manuales";
import { LOCAL_VACIO } from "@/lib/admin/opciones";
import { FormularioLocal } from "../formulario-local";

export default async function NuevoLocal({ params }: PageProps<"/admin/[clave]/locales/nuevo">) {
  exigirClave((await params).clave);
  const generos = await generosConocidos();
  return (
    <>
      <section className="adm-titulo">
        <h1>Nuevo local</h1>
        <p className="muted">Los campos con * son obligatorios.</p>
      </section>
      <FormularioLocal inicial={LOCAL_VACIO} id={null} generos={generos} />
    </>
  );
}

// Herramienta interna: puede esperar a la base de datos al cargar.
export const instant = false;
