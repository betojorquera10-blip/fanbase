"use client";

// Cargador manual de eventos: los mismos datos que tienen los eventos de las
// ticketeras, para que en el sitio se vean y filtren igual.

import { useActionState, useState } from "react";
import Link from "next/link";
import { CATEGORIA_MUSICA } from "@/lib/categorias";
import { CATEGORIAS, FORMAS_COMPRA } from "@/lib/admin/opciones";
import type { DatosEvento, LugarConocido } from "@/lib/admin/manuales";
import { guardarEventoAccion, type Estado } from "../acciones";
import { Errores, SelectorRegionComuna, SubirFoto, UsarLugarConocido, useClave } from "../componentes";

export function FormularioEvento({ inicial, grupo, generos, lugares }: {
  inicial: DatosEvento;
  grupo: string | null;
  generos: string[];
  lugares: LugarConocido[];
}) {
  const clave = useClave();
  const [d, setD] = useState<DatosEvento>(inicial);
  const [estado, accion, pendiente] = useActionState<Estado, FormData>(guardarEventoAccion.bind(null, clave, grupo), { errores: [] });
  const cambiar = (parcial: Partial<DatosEvento>) => setD((x) => ({ ...x, ...parcial }));
  const cambiarFuncion = (i: number, parcial: Partial<DatosEvento["funciones"][number]>) =>
    cambiar({ funciones: d.funciones.map((f, k) => (k === i ? { ...f, ...parcial } : f)) });
  const cambiarEntrada = (i: number, parcial: Partial<DatosEvento["entradas"][number]>) =>
    cambiar({ entradas: d.entradas.map((e, k) => (k === i ? { ...e, ...parcial } : e)) });
  const musica = d.categoria === CATEGORIA_MUSICA;
  const pideEnlace = d.formaCompra === "link" || d.formaCompra === "inscripcion";
  const pideContacto = d.formaCompra === "contacto" || d.formaCompra === "inscripcion";

  return (
    <form action={accion} className="adm-form">
      <input type="hidden" name="datos" value={JSON.stringify(d)} />

      <fieldset>
        <legend>1. El evento</legend>
        <div className="adm-grilla">
          <label className="adm-campo adm-ancho">
            <span>Nombre del evento *</span>
            <input value={d.nombre} onChange={(ev) => cambiar({ nombre: ev.target.value })} placeholder="Ej. Festival de bandas del Colegio San Andrés" />
          </label>
          <label className="adm-campo">
            <span>Categoría *</span>
            <select value={d.categoria} onChange={(ev) => cambiar({ categoria: ev.target.value })}>
              {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          {musica ? (
            <label className="adm-campo">
              <span>Género musical</span>
              <input value={d.genero} onChange={(ev) => cambiar({ genero: ev.target.value })} list="generos" placeholder="Ej. Rock, Jazz, Cumbia" />
              <datalist id="generos">{generos.map((g) => <option key={g} value={g} />)}</datalist>
            </label>
          ) : <span />}
          <label className="adm-campo adm-ancho">
            <span>Artista, elenco u organizador</span>
            <input value={d.artista} onChange={(ev) => cambiar({ artista: ev.target.value })} placeholder="Opcional" />
          </label>
          <label className="adm-campo adm-ancho">
            <span>Descripción</span>
            <textarea
              rows={5}
              value={d.descripcion}
              onChange={(ev) => cambiar({ descripcion: ev.target.value })}
              placeholder={"La primera línea se muestra como bajada.\n\nDeja una línea en blanco entre párrafos."}
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>2. Fechas</legend>
        <p className="muted">Si el evento tiene varias funciones, agrega una fila por cada una. Para exposiciones o ferias de varios días, usa «Hasta».</p>
        {d.funciones.map((f, i) => (
          <div key={i} className="adm-fila">
            <label className="adm-campo"><span>Fecha *</span><input type="date" value={f.fecha} onChange={(ev) => cambiarFuncion(i, { fecha: ev.target.value })} /></label>
            <label className="adm-campo"><span>Hora</span><input type="time" value={f.hora} onChange={(ev) => cambiarFuncion(i, { hora: ev.target.value })} /></label>
            <label className="adm-campo"><span>Hasta (opcional)</span><input type="date" value={f.fechaFin} min={f.fecha} onChange={(ev) => cambiarFuncion(i, { fechaFin: ev.target.value })} /></label>
            {d.funciones.length > 1 && (
              <button type="button" className="adm-link adm-quitar" onClick={() => cambiar({ funciones: d.funciones.filter((_, k) => k !== i) })}>Quitar</button>
            )}
          </div>
        ))}
        <button type="button" className="ghost" onClick={() => cambiar({ funciones: [...d.funciones, { ...d.funciones[d.funciones.length - 1], fecha: "" }] })}>
          + Agregar otra función
        </button>
      </fieldset>

      <fieldset>
        <legend>3. Lugar</legend>
        <div className="adm-grilla">
          <UsarLugarConocido lugares={lugares} onElegir={(l) => cambiar({ lugar: { nombre: l.nombre, region: l.region, comuna: l.comuna, direccion: l.direccion } })} />
          <label className="adm-campo adm-ancho">
            <span>Nombre del lugar *</span>
            <input value={d.lugar.nombre} onChange={(ev) => cambiar({ lugar: { ...d.lugar, nombre: ev.target.value } })} placeholder="Ej. Gimnasio Colegio San Andrés" />
          </label>
          <SelectorRegionComuna region={d.lugar.region} comuna={d.lugar.comuna} onCambio={(region, comuna) => cambiar({ lugar: { ...d.lugar, region, comuna } })} />
          <label className="adm-campo adm-ancho">
            <span>Dirección *</span>
            <input value={d.lugar.direccion} onChange={(ev) => cambiar({ lugar: { ...d.lugar, direccion: ev.target.value } })} placeholder="Ej. Av. Pedro de Valdivia 1234" />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>4. Foto o afiche</legend>
        <SubirFoto url={d.imagenUrl} onCambio={(imagenUrl) => cambiar({ imagenUrl })} texto="Se muestra en la tarjeta del evento. Mejor horizontal." />
      </fieldset>

      <fieldset>
        <legend>5. Entradas</legend>
        <label className="adm-check">
          <input type="checkbox" checked={d.gratis} onChange={(ev) => cambiar({ gratis: ev.target.checked })} /> Evento gratis
        </label>
        {!d.gratis && (
          <>
            <p className="muted">Un tipo de entrada por fila (General, Estudiante, VIP…). El precio en pesos, sin puntos.</p>
            {d.entradas.map((e, i) => (
              <div key={i} className="adm-fila">
                <label className="adm-campo"><span>Tipo de entrada</span><input value={e.nombre} onChange={(ev) => cambiarEntrada(i, { nombre: ev.target.value })} /></label>
                <label className="adm-campo"><span>Precio $</span><input inputMode="numeric" value={e.precio} onChange={(ev) => cambiarEntrada(i, { precio: ev.target.value })} placeholder="5000" /></label>
                <label className="adm-check"><input type="checkbox" checked={e.agotado} onChange={(ev) => cambiarEntrada(i, { agotado: ev.target.checked })} /> Agotada</label>
                {d.entradas.length > 1 && (
                  <button type="button" className="adm-link adm-quitar" onClick={() => cambiar({ entradas: d.entradas.filter((_, k) => k !== i) })}>Quitar</button>
                )}
              </div>
            ))}
            <button type="button" className="ghost" onClick={() => cambiar({ entradas: [...d.entradas, { nombre: "", precio: "", agotado: false }] })}>
              + Agregar tipo de entrada
            </button>
          </>
        )}
        <div className="adm-grilla adm-separado">
          <label className="adm-campo adm-ancho">
            <span>¿Cómo se consiguen las entradas? *</span>
            <select value={d.formaCompra} onChange={(ev) => cambiar({ formaCompra: ev.target.value as DatosEvento["formaCompra"] })}>
              {FORMAS_COMPRA.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </label>
          {pideEnlace && (
            <label className="adm-campo adm-ancho">
              <span>{d.formaCompra === "link" ? "Link de compra *" : "Link de inscripción"}</span>
              <input type="url" value={d.enlace} onChange={(ev) => cambiar({ enlace: ev.target.value })} placeholder="https://" />
            </label>
          )}
          {pideContacto && (
            <label className="adm-campo adm-ancho">
              <span>{d.formaCompra === "contacto" ? "Teléfono, WhatsApp o correo *" : "Contacto para inscribirse"}</span>
              <input value={d.contacto} onChange={(ev) => cambiar({ contacto: ev.target.value })} placeholder="+56 9 1234 5678 o correo@ejemplo.cl" />
            </label>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>6. Publicación</legend>
        <label className="adm-check">
          <input type="checkbox" checked={d.visible} onChange={(ev) => cambiar({ visible: ev.target.checked })} /> Visible en el sitio
        </label>
        <p className="muted">En el sitio aparece como «Publicado por FanBase».</p>
      </fieldset>

      <Errores errores={estado.errores} />
      <div className="adm-botonera">
        <button className="primary" disabled={pendiente}>{pendiente ? "Guardando…" : grupo ? "Guardar cambios" : "Publicar evento"}</button>
        <Link className="ghost" href={`/admin/${clave}/eventos`}>Cancelar</Link>
      </div>
    </form>
  );
}
