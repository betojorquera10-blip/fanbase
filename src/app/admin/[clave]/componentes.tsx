"use client";

// Piezas compartidas de las pantallas del panel de administración.

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { REGIONES } from "@/lib/regiones";
import type { LugarConocido } from "@/lib/admin/manuales";
import { guardarFuenteAccion, subirFotoAccion, type Estado } from "./acciones";

export function useClave(): string {
  return String(useParams<{ clave: string }>().clave);
}

export function NavAdmin() {
  const clave = useClave();
  const ruta = usePathname();
  const base = `/admin/${clave}`;
  const secciones = [
    { href: base, nombre: "Resumen" },
    { href: `${base}/eventos`, nombre: "Eventos manuales" },
    { href: `${base}/locales`, nombre: "Locales" },
  ];
  return (
    <nav className="nav adm-nav">
      {secciones.map((s) => {
        const activa = s.href === base ? ruta === base : ruta.startsWith(s.href);
        return (
          <Link key={s.href} href={s.href} className={`nav-link ${activa ? "active" : ""}`}>
            {s.nombre}
          </Link>
        );
      })}
      <a href="/" target="_blank" rel="noopener" className="nav-link">Ver sitio ↗</a>
    </nav>
  );
}

export function Errores({ errores }: { errores: string[] }) {
  if (errores.length === 0) return null;
  return (
    <div className="adm-errores" role="alert">
      <strong>Falta completar o corregir:</strong>
      <ul>{errores.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
}

// Región → comuna. Al cambiar de región se suelta la comuna.
export function SelectorRegionComuna({ region, comuna, onCambio }: {
  region: string;
  comuna: string;
  onCambio: (region: string, comuna: string) => void;
}) {
  const comunas = REGIONES.find((r) => r.nombre === region)?.comunas ?? [];
  return (
    <>
      <label className="adm-campo">
        <span>Región *</span>
        <select value={region} onChange={(ev) => onCambio(ev.target.value, "")}>
          <option value="">Elige la región</option>
          {REGIONES.map((r) => <option key={r.nombre} value={r.nombre}>{r.nombre === "Metropolitana" ? "Región Metropolitana" : r.nombre}</option>)}
        </select>
      </label>
      <label className="adm-campo">
        <span>Comuna *</span>
        <select value={comuna} onChange={(ev) => onCambio(region, ev.target.value)} disabled={!region}>
          <option value="">{region ? "Elige la comuna" : "Primero elige la región"}</option>
          {[...comunas].sort((a, b) => a.localeCompare(b, "es")).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
    </>
  );
}

// Para no reescribir un lugar que ya se usó.
export function UsarLugarConocido({ lugares, onElegir }: { lugares: LugarConocido[]; onElegir: (l: LugarConocido) => void }) {
  if (lugares.length === 0) return null;
  return (
    <label className="adm-campo adm-ancho">
      <span>Usar un lugar ya registrado (opcional)</span>
      <select
        value=""
        onChange={(ev) => {
          const l = lugares[Number(ev.target.value)];
          if (l) onElegir(l);
        }}
      >
        <option value="">Elegir…</option>
        {lugares.map((l, i) => <option key={`${l.nombre}|${l.comuna}`} value={i}>{l.nombre} · {l.comuna}</option>)}
      </select>
    </label>
  );
}

// Achica la foto en el navegador antes de subirla (máx. 1600 px, JPG): así
// pesa unos cientos de KB aunque venga directo de la cámara del celular.
async function achicar(archivo: File): Promise<Blob> {
  const MAX = 1600;
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo procesar la foto."))), "image/jpeg", 0.85));
}

export function SubirFoto({ url, onCambio, texto }: { url: string; onCambio: (url: string) => void; texto: string }) {
  const clave = useClave();
  const [estado, setEstado] = useState<{ subiendo: boolean; error?: string }>({ subiendo: false });

  async function elegir(archivo: File | undefined) {
    if (!archivo) return;
    setEstado({ subiendo: true });
    try {
      const fd = new FormData();
      fd.append("foto", new File([await achicar(archivo)], "foto.jpg", { type: "image/jpeg" }));
      const r = await subirFotoAccion(clave, fd);
      if (r.url) onCambio(r.url);
      setEstado({ subiendo: false, error: r.error });
    } catch (err) {
      setEstado({ subiendo: false, error: err instanceof Error ? err.message : "No se pudo subir la foto." });
    }
  }

  return (
    <div className="adm-foto">
      <div className="adm-foto-vista">
        {/* eslint-disable-next-line @next/next/no-img-element -- vista previa de una foto recién subida */}
        {url ? <img src={url} alt="" /> : <span>Sin foto</span>}
      </div>
      <div className="adm-foto-acciones">
        <p className="muted">{texto}</p>
        <label className="ghost adm-boton-archivo">
          {estado.subiendo ? "Subiendo…" : url ? "Cambiar foto" : "Elegir foto"}
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={estado.subiendo} onChange={(ev) => elegir(ev.target.files?.[0])} />
        </label>
        {url && <button type="button" className="adm-link" onClick={() => onCambio("")}>Quitar foto</button>}
        {estado.error && <p className="adm-error-texto">{estado.error}</p>}
      </div>
    </div>
  );
}

// Botones Editar, Ocultar/Mostrar y Borrar de una fila de la lista.
export function AccionesFila({ visible, nombre, onVisible, onBorrar, editar }: {
  visible: boolean;
  nombre: string;
  onVisible: (visible: boolean) => Promise<void>;
  onBorrar: () => Promise<void>;
  editar: string;
}) {
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  const correr = (accion: () => Promise<void>) =>
    iniciar(async () => {
      await accion();
      router.refresh();
    });
  return (
    <div className="adm-acciones">
      <Link className="ghost" href={editar}>Editar</Link>
      <button className="ghost" disabled={pendiente} onClick={() => correr(() => onVisible(!visible))}>
        {visible ? "Ocultar" : "Mostrar"}
      </button>
      <button
        className="ghost adm-peligro"
        disabled={pendiente}
        onClick={() => confirm(`¿Borrar "${nombre}"? No se puede deshacer.`) && correr(onBorrar)}
      >
        Borrar
      </button>
    </div>
  );
}

// Una fuente del panel resumen: activa, cada cuántas horas y qué días del mes.
export function FormFuente({ id, activa, horas, dias }: { id: string; activa: boolean; horas: number; dias: string | null }) {
  const clave = useClave();
  const [estado, accion, pendiente] = useActionState<Estado, FormData>(guardarFuenteAccion.bind(null, clave, id), { errores: [] });
  return (
    <form action={accion} className="adm-fuente-form">
      <label className="adm-check"><input type="checkbox" name="activa" defaultChecked={activa} /> Activa</label>
      <label>Cada <input name="horas" type="number" min={1} max={744} defaultValue={horas} /> h</label>
      <label>Días del mes <input name="dias" defaultValue={dias ?? ""} placeholder="todos" size={7} /></label>
      <button className="ghost" disabled={pendiente}>{pendiente ? "…" : "Guardar"}</button>
      {estado.ok && !pendiente && <span className="adm-ok-texto">✓ {estado.ok}</span>}
      {estado.errores.map((e) => <span key={e} className="adm-error-texto">{e}</span>)}
    </form>
  );
}
