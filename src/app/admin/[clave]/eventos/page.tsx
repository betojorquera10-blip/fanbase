import Link from "next/link";
import { exigirClave } from "@/lib/admin/acceso";
import { listarEventosManuales } from "@/lib/admin/manuales";
import { formatearFecha } from "@/lib/fechas";
import { borrarEventoAccion, visibilidadEventoAccion } from "../acciones";
import { AccionesFila } from "../componentes";

const AVISOS: Record<string, string> = { creado: "Evento publicado.", editado: "Cambios guardados." };

export default async function EventosManuales({ params, searchParams }: PageProps<"/admin/[clave]/eventos">) {
  const { clave } = await params;
  exigirClave(clave);
  const { listo } = await searchParams;
  const eventos = await listarEventosManuales();

  return (
    <>
      <section className="adm-titulo adm-titulo-con-boton">
        <div>
          <h1>Eventos manuales</h1>
          <p className="muted">Eventos que no están en las ticketeras: colegios, beneficios, eventos privados… En el sitio se ven y filtran igual que los demás.</p>
        </div>
        <Link className="primary" href={`/admin/${clave}/eventos/nuevo`}>+ Nuevo evento</Link>
      </section>
      {typeof listo === "string" && AVISOS[listo] && <div className="adm-aviso">✓ {AVISOS[listo]}</div>}

      {eventos.length === 0 ? (
        <div className="empty">Todavía no hay eventos cargados a mano.</div>
      ) : (
        <div className="adm-lista">
          {eventos.map((e) => (
            <div key={e.grupo} className={`adm-item ${e.visible ? "" : "adm-inactiva"}`}>
              <div className="adm-item-foto">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura del panel */}
                {e.imagen ? <img src={e.imagen} alt="" /> : <span>{e.categoria}</span>}
              </div>
              <div className="adm-item-texto">
                <strong>{e.nombre}</strong>
                <span className="muted">{e.categoria} · {e.lugar}</span>
                <span className="muted">
                  {e.proxima ? `Próxima: ${formatearFecha(e.proxima)}` : `Terminó el ${e.ultima ? formatearFecha(e.ultima) : "—"}`}
                  {e.funciones > 1 && ` · ${e.funciones} funciones`}
                  {e.gratis && " · Gratis"}
                  {!e.visible && " · Oculto"}
                </span>
              </div>
              <AccionesFila
                visible={e.visible}
                nombre={e.nombre}
                editar={`/admin/${clave}/eventos/${e.grupo}`}
                onVisible={visibilidadEventoAccion.bind(null, clave, e.grupo)}
                onBorrar={borrarEventoAccion.bind(null, clave, e.grupo)}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Herramienta interna: puede esperar a la base de datos al cargar.
export const instant = false;
