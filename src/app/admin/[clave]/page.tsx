// Panel resumen: el universo de datos de FanBase, las fuentes y su frecuencia,
// y lo que cuesta mantenerlo actualizado.

import Link from "next/link";
import { exigirClave } from "@/lib/admin/acceso";
import { resumenPanel } from "@/lib/admin/resumen";
import { FormFuente } from "./componentes";

const numero = (n: number) => Math.round(n).toLocaleString("es-CL");
const fechaHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short" }) : "—";
const ESTADOS: Record<string, string> = { ok: "OK", con_errores: "Con errores", fallida: "Falló", en_curso: "En curso" };

function Lista({ titulo, filas, total }: { titulo: string; filas: { nombre: string; cantidad: number }[]; total: number }) {
  return (
    <div className="adm-caja">
      <h3>{titulo}</h3>
      {filas.map((f) => (
        <div key={f.nombre} className="adm-barra">
          <span>{f.nombre === "Metropolitana" ? "Región Metropolitana" : f.nombre}</span>
          <span className="adm-barra-fondo"><span style={{ width: `${(f.cantidad / Math.max(total, 1)) * 100}%` }} /></span>
          <strong>{numero(f.cantidad)}</strong>
        </div>
      ))}
    </div>
  );
}

export default async function PanelResumen({ params }: PageProps<"/admin/[clave]">) {
  const { clave } = await params;
  exigirClave(clave);
  const r = await resumenPanel();
  const usoBase = r.base.bytes / r.base.limite;
  const proyeccion = (x: number) => (r.consumo.dias ? (x / r.consumo.dias) * 30 : 0);

  return (
    <>
      <section className="adm-titulo">
        <h1>Resumen</h1>
        <p className="muted">Datos al {fechaHora(new Date().toISOString())}. Cuenta los eventos visibles de hoy en adelante.</p>
      </section>

      <section className="adm-kpis">
        <div className="adm-kpi"><small>Próximos eventos</small><strong>{numero(r.eventos.total)}</strong></div>
        <div className="adm-kpi"><small>Gratis</small><strong>{numero(r.eventos.gratis)}</strong></div>
        <div className="adm-kpi"><small>Agotados</small><strong>{numero(r.eventos.agotados)}</strong></div>
        <div className="adm-kpi">
          <small>Cargados a mano</small><strong>{numero(r.eventos.manuales)}</strong>
          <Link href={`/admin/${clave}/eventos`}>Ver eventos →</Link>
        </div>
        <div className="adm-kpi">
          <small>Locales visibles</small><strong>{numero(r.locales.total)}</strong>
          <Link href={`/admin/${clave}/locales`}>Ver locales →</Link>
        </div>
      </section>

      <section className="adm-columnas">
        <Lista titulo="Eventos por categoría" filas={r.eventos.porCategoria} total={r.eventos.total} />
        <Lista titulo="Eventos por región" filas={r.eventos.porRegion} total={r.eventos.total} />
        <div className="adm-caja">
          <h3>Locales</h3>
          {r.locales.porTipo.map((t) => <div key={t.nombre} className="adm-dato"><span>{t.nombre}</span><strong>{t.cantidad}</strong></div>)}
          <div className="adm-dato"><span>Con música en vivo</span><strong>{r.locales.conMusica}</strong></div>
          <div className="adm-dato"><span>De ejemplo (inventados)</span><strong>{r.locales.ejemplos}</strong></div>
          <div className="adm-dato"><span>Ocultos</span><strong>{r.locales.ocultos}</strong></div>
        </div>
      </section>

      <section>
        <div className="section-head">
          <div>
            <h2>Fuentes</h2>
            <p>Sitios de los que FanBase lee eventos automáticamente, una vez al día a las 10:00.</p>
          </div>
        </div>
        <div className="adm-tabla-envoltorio">
          <table className="adm-tabla">
            <thead>
              <tr>
                <th>Fuente</th>
                <th>Próximos eventos</th>
                <th>Última corrida</th>
                <th>Consumo 30 días</th>
                <th>Frecuencia del listado</th>
              </tr>
            </thead>
            <tbody>
              {r.fuentes.map((f) => (
                <tr key={f.id} className={f.activa ? "" : "adm-inactiva"}>
                  <td>
                    <strong>{f.nombre}</strong>
                    <br />
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="adm-url">{f.url.replace(/^https?:\/\//, "")}</a>
                  </td>
                  <td className="adm-num">{numero(f.eventos)}</td>
                  <td>
                    {f.ultimaCorrida ? (
                      <>
                        {fechaHora(f.ultimaCorrida.en)}
                        <br />
                        <span className={`pill ${f.ultimaCorrida.estado === "ok" ? "pill-free" : "pill-danger"}`}>{ESTADOS[f.ultimaCorrida.estado] ?? f.ultimaCorrida.estado}</span>{" "}
                        <span className="muted">{f.ultimaCorrida.nuevos} nuevos{f.ultimaCorrida.errores ? `, ${f.ultimaCorrida.errores} errores` : ""}</span>
                      </>
                    ) : <span className="muted">Sin corridas registradas</span>}
                  </td>
                  <td>
                    {f.consumo ? (
                      <span className="muted">
                        {f.consumo.corridas} corridas · {numero(f.consumo.minutos)} min
                        <br />
                        {numero(f.consumo.solicitudes)} descargas · {f.consumo.mb.toFixed(0)} MB
                      </span>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td>
                    <FormFuente id={f.id} activa={f.activa} horas={f.horasEntreListados} dias={f.diasDelMes} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted adm-nota">
          <strong>Frecuencia:</strong> cada cuántas horas, como mínimo, se vuelve a leer el listado de la fuente (y en qué días del mes, ej. &quot;1,2,3&quot;).
          Como la lectura corre una vez al día, cualquier valor bajo 24 h significa &quot;todos los días&quot;. Los precios de cada evento se revisan aparte:{" "}
          {r.reglas.map((g) => `${g.descripcion.toLowerCase()}, cada ${g.horas} h`).join("; ")}.
          <br />
          <strong>Ojo:</strong> en staging estos cambios son solo de prueba: los scrapers leen la configuración de producción y la copia diaria los reemplaza.
        </p>
      </section>

      <section>
        <div className="section-head">
          <div>
            <h2>Costo de mantenerlo</h2>
            <p>Últimos 30 días{r.consumo.dias ? ` (${r.consumo.dias} días con corridas)` : ""}, y lo que significa en un mes.</p>
          </div>
        </div>
        <div className="adm-kpis">
          <div className="adm-kpi"><small>Tiempo de máquina al mes</small><strong>{numero(proyeccion(r.consumo.minutos))} min</strong></div>
          <div className="adm-kpi"><small>Descargas al mes</small><strong>{(proyeccion(r.consumo.mb) / 1024).toFixed(1)} GB</strong></div>
          <div className="adm-kpi"><small>Tokens de IA al mes</small><strong>{numero(proyeccion(r.consumo.tokens))}</strong><span className="muted">Las fuentes se leen sin IA: $0</span></div>
          <div className="adm-kpi">
            <small>Base de datos</small>
            <strong>{(r.base.bytes / 1024 / 1024).toFixed(0)} MB</strong>
            <span className="muted">{(usoBase * 100).toFixed(1)}% de los 500 MB gratis · {r.base.fotos} fotos</span>
          </div>
        </div>
      </section>
    </>
  );
}

// Herramienta interna: puede esperar a la base de datos al cargar.
export const instant = false;
