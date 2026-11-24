"use client";

// Ingresador de locales: bares, restaurantes, cafés y lugares de comida, con
// dirección por región y comuna para que respondan a los filtros del sitio.

import { useActionState, useState } from "react";
import Link from "next/link";
import { DIAS_SEMANA, nombreDia } from "@/lib/dias";
import { NIVELES_PRECIO, TIPOS_LOCAL } from "@/lib/admin/opciones";
import type { DatosLocal } from "@/lib/admin/manuales";
import { guardarLocalAccion, type Estado } from "../acciones";
import { Errores, SelectorRegionComuna, SubirFoto, useClave } from "../componentes";

export function FormularioLocal({ inicial, id, generos }: { inicial: DatosLocal; id: number | null; generos: string[] }) {
  const clave = useClave();
  const [d, setD] = useState<DatosLocal>(inicial);
  const [estado, accion, pendiente] = useActionState<Estado, FormData>(guardarLocalAccion.bind(null, clave, id), { errores: [] });
  const cambiar = (parcial: Partial<DatosLocal>) => setD((x) => ({ ...x, ...parcial }));
  const cambiarShow = (i: number, parcial: Partial<DatosLocal["programacion"][number]>) =>
    cambiar({ programacion: d.programacion.map((s, k) => (k === i ? { ...s, ...parcial } : s)) });

  return (
    <form action={accion} className="adm-form">
      <input type="hidden" name="datos" value={JSON.stringify(d)} />

      <fieldset>
        <legend>1. El local</legend>
        <div className="adm-grilla">
          <label className="adm-campo adm-ancho">
            <span>Nombre *</span>
            <input value={d.nombre} onChange={(ev) => cambiar({ nombre: ev.target.value })} placeholder="Ej. La Batuta" />
          </label>
          <label className="adm-campo">
            <span>Tipo de local *</span>
            <select value={d.tipo} onChange={(ev) => cambiar({ tipo: ev.target.value as DatosLocal["tipo"] })}>
              {TIPOS_LOCAL.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>
          <label className="adm-campo">
            <span>Nivel de precio</span>
            <select value={d.nivelPrecio} onChange={(ev) => cambiar({ nivelPrecio: ev.target.value })}>
              {NIVELES_PRECIO.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <label className="adm-check adm-ancho">
            <input type="checkbox" checked={d.musicaEnVivo} onChange={(ev) => cambiar({ musicaEnVivo: ev.target.checked })} />
            Tiene música en vivo (si no, aparece en «No música»)
          </label>
          <label className="adm-campo adm-ancho">
            <span>{d.musicaEnVivo ? "Estilo de música *" : "Tipo de cocina o especialidad *"}</span>
            <input
              value={d.genero}
              onChange={(ev) => cambiar({ genero: ev.target.value })}
              list={d.musicaEnVivo ? "generos" : undefined}
              placeholder={d.musicaEnVivo ? "Ej. Rock, Jazz, Tango" : "Ej. Sushi, Comida peruana, Sándwiches"}
            />
            <datalist id="generos">{generos.map((g) => <option key={g} value={g} />)}</datalist>
          </label>
          <label className="adm-campo adm-ancho">
            <span>Descripción</span>
            <textarea rows={3} value={d.descripcion} onChange={(ev) => cambiar({ descripcion: ev.target.value })} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>2. Dirección</legend>
        <div className="adm-grilla">
          <SelectorRegionComuna region={d.region} comuna={d.comuna} onCambio={(region, comuna) => cambiar({ region, comuna })} />
          <label className="adm-campo adm-ancho">
            <span>Dirección *</span>
            <input value={d.direccion} onChange={(ev) => cambiar({ direccion: ev.target.value })} placeholder="Ej. Jorge Washington 52" />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>3. Foto</legend>
        <SubirFoto url={d.imagenUrl} onCambio={(imagenUrl) => cambiar({ imagenUrl })} texto="Fachada, interior o un plato. Mejor horizontal." />
      </fieldset>

      <fieldset>
        <legend>4. Horario y contacto</legend>
        <div className="adm-grilla">
          <label className="adm-campo adm-ancho">
            <span>Horario de atención</span>
            <input value={d.horario} onChange={(ev) => cambiar({ horario: ev.target.value })} placeholder="Ej. Mar a sáb, 19:00 a 02:00" />
          </label>
          <label className="adm-campo">
            <span>Teléfono o WhatsApp</span>
            <input value={d.telefono} onChange={(ev) => cambiar({ telefono: ev.target.value })} placeholder="+56 9 1234 5678" />
          </label>
          <label className="adm-campo">
            <span>Instagram</span>
            <input value={d.instagram} onChange={(ev) => cambiar({ instagram: ev.target.value })} placeholder="@local" />
          </label>
          <label className="adm-campo adm-ancho">
            <span>Sitio web</span>
            <input type="url" value={d.sitioWeb} onChange={(ev) => cambiar({ sitioWeb: ev.target.value })} placeholder="https://" />
          </label>
        </div>
      </fieldset>

      {d.musicaEnVivo && (
        <fieldset>
          <legend>5. Programación semanal</legend>
          <p className="muted">Lo que se repite cada semana. Para un show puntual, cárgalo como evento en «Eventos manuales» con este local como lugar.</p>
          <label className="adm-check">
            <input type="checkbox" checked={d.entradaLiberada} onChange={(ev) => cambiar({ entradaLiberada: ev.target.checked })} /> Entrada liberada
          </label>
          {d.programacion.map((s, i) => (
            <div key={i} className="adm-fila">
              <label className="adm-campo">
                <span>Día</span>
                <select value={s.dia} onChange={(ev) => cambiarShow(i, { dia: ev.target.value as DatosLocal["programacion"][number]["dia"] })}>
                  {DIAS_SEMANA.map((dia) => <option key={dia} value={dia}>{nombreDia(dia)}</option>)}
                </select>
              </label>
              <label className="adm-campo adm-crece"><span>Qué hay</span><input value={s.evento} onChange={(ev) => cambiarShow(i, { evento: ev.target.value })} placeholder="Ej. Jam session" /></label>
              <label className="adm-campo"><span>Hora</span><input type="time" value={s.hora} onChange={(ev) => cambiarShow(i, { hora: ev.target.value })} /></label>
              <button type="button" className="adm-link adm-quitar" onClick={() => cambiar({ programacion: d.programacion.filter((_, k) => k !== i) })}>Quitar</button>
            </div>
          ))}
          <button type="button" className="ghost" onClick={() => cambiar({ programacion: [...d.programacion, { dia: "viernes", evento: "", hora: "22:00" }] })}>
            + Agregar show semanal
          </button>
        </fieldset>
      )}

      <fieldset>
        <legend>{d.musicaEnVivo ? "6" : "5"}. Publicación</legend>
        <label className="adm-check">
          <input type="checkbox" checked={d.visible} onChange={(ev) => cambiar({ visible: ev.target.checked })} /> Visible en el sitio
        </label>
      </fieldset>

      <Errores errores={estado.errores} />
      <div className="adm-botonera">
        <button className="primary" disabled={pendiente}>{pendiente ? "Guardando…" : id ? "Guardar cambios" : "Publicar local"}</button>
        <Link className="ghost" href={`/admin/${clave}/locales`}>Cancelar</Link>
      </div>
    </form>
  );
}
