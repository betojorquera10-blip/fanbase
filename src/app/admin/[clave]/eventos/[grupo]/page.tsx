import { notFound } from "next/navigation";
import { exigirClave } from "@/lib/admin/acceso";
import { generosConocidos, leerEvento, lugaresConocidos } from "@/lib/admin/manuales";
import { FormularioEvento } from "../formulario-evento";

export default async function EditarEvento({ params }: PageProps<"/admin/[clave]/eventos/[grupo]">) {
  const { clave, grupo } = await params;
  exigirClave(clave);
  const [evento, generos, lugares] = await Promise.all([leerEvento(grupo), generosConocidos(), lugaresConocidos()]);
  if (!evento) notFound();
  return (
    <>
      <section className="adm-titulo">
        <h1>Editar evento</h1>
        <p className="muted">{evento.nombre}</p>
      </section>
      <FormularioEvento inicial={evento} grupo={grupo} generos={generos} lugares={lugares} />
    </>
  );
}

// Herramienta interna: puede esperar a la base de datos al cargar.
export const instant = false;
