import { notFound } from "next/navigation";
import { exigirClave } from "@/lib/admin/acceso";
import { generosConocidos, leerLocal } from "@/lib/admin/manuales";
import { FormularioLocal } from "../formulario-local";

export default async function EditarLocal({ params }: PageProps<"/admin/[clave]/locales/[id]">) {
  const { clave, id } = await params;
  exigirClave(clave);
  const n = Number(id);
  const [local, generos] = await Promise.all([Number.isInteger(n) ? leerLocal(n) : null, generosConocidos()]);
  if (!local) notFound();
  return (
    <>
      <section className="adm-titulo">
        <h1>Editar local</h1>
        <p className="muted">{local.nombre}</p>
      </section>
      <FormularioLocal inicial={local} id={n} generos={generos} />
    </>
  );
}

// Herramienta interna: puede esperar a la base de datos al cargar.
export const instant = false;
