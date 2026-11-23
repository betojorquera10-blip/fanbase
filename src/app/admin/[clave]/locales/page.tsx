import Link from "next/link";
import { exigirClave } from "@/lib/admin/acceso";
import { listarLocales } from "@/lib/admin/manuales";
import { nombreTipoLocal } from "@/lib/admin/opciones";
import { borrarLocalAccion, visibilidadLocalAccion } from "../acciones";
import { AccionesFila } from "../componentes";

const AVISOS: Record<string, string> = { creado: "Local publicado.", editado: "Cambios guardados." };

export default async function Locales({ params, searchParams }: PageProps<"/admin/[clave]/locales">) {
  const { clave } = await params;
  exigirClave(clave);
  const { listo } = await searchParams;
  const locales = await listarLocales();

  return (
    <>
      <section className="adm-titulo adm-titulo-con-boton">
        <div>
          <h1>Locales</h1>
          <p className="muted">Bares, restaurantes, cafés y lugares de comida. Con su dirección aparecen al filtrar por región y comuna.</p>
        </div>
        <Link className="primary" href={`/admin/${clave}/locales/nuevo`}>+ Nuevo local</Link>
      </section>
      {typeof listo === "string" && AVISOS[listo] && <div className="adm-aviso">✓ {AVISOS[listo]}</div>}

      {locales.length === 0 ? (
        <div className="empty">Todavía no hay locales.</div>
      ) : (
        <div className="adm-lista">
          {locales.map((l) => (
            <div key={l.id} className={`adm-item ${l.visible ? "" : "adm-inactiva"}`}>
              <div className="adm-item-foto">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura del panel */}
                {l.imagen ? <img src={l.imagen} alt="" /> : <span>{nombreTipoLocal(l.tipo)}</span>}
              </div>
              <div className="adm-item-texto">
                <strong>{l.nombre}{l.esEjemplo && <span className="pill pill-demo adm-pill">Ejemplo</span>}</strong>
                <span className="muted">
                  {nombreTipoLocal(l.tipo)} · {l.comuna}{l.region ? `, ${l.region === "Metropolitana" ? "RM" : l.region}` : ""}
                </span>
                <span className="muted">
                  {l.musicaEnVivo ? `Música en vivo · ${l.shows} ${l.shows === 1 ? "show semanal" : "shows semanales"}` : "Sin música en vivo"}
                  {!l.visible && " · Oculto"}
                </span>
              </div>
              <AccionesFila
                visible={l.visible}
                nombre={l.nombre}
                editar={`/admin/${clave}/locales/${l.id}`}
                onVisible={visibilidadLocalAccion.bind(null, clave, l.id)}
                onBorrar={borrarLocalAccion.bind(null, clave, l.id)}
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
