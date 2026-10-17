// Búsqueda de eventos: la usan la API (/api/v1/eventos), el sitio y los
// scripts de consola, para que todos respondan exactamente lo mismo.

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { hoyEnChile, normalizar } from "@/lib/fechas";
import { CATEGORIA_MUSICA, type TipoEvento } from "@/lib/categorias";
import { ubicarComuna } from "@/lib/regiones";
import { calzaPrecio, hayRango, sectorEnRango, type RangoPrecio, type TipoPrecio } from "@/lib/precios";

// Se re-exportan para quienes ya los importaban desde acá (API y scripts).
export { hoyEnChile, proximoFinDeSemana } from "@/lib/fechas";

export type { TipoPrecio } from "@/lib/precios";

export interface FiltrosEventos {
  desde?: string; // "YYYY-MM-DD" — por defecto, hoy
  hasta?: string; // "YYYY-MM-DD"
  precioMin?: number; // CLP — junto con precioMax: alguna entrada del evento debe estar en el rango
  precioMax?: number; // CLP
  tipoPrecio?: TipoPrecio;
  genero?: string; // texto libre, ej. "rock" (ignora mayúsculas y tildes)
  texto?: string; // busca en nombre, artista y descripción
  tipo?: TipoEvento; // "musica" (por defecto), "otros" (teatro, exposiciones...) o "todos"
  incluirAgotados?: boolean;
  limite?: number;
}

export const LIMITE_MAXIMO = 100;

export async function buscarEventos(filtros: FiltrosEventos = {}) {
  const tipoPrecio = filtros.tipoPrecio ?? "base";
  const desde = filtros.desde ?? hoyEnChile();
  // La API valida que no pase de LIMITE_MAXIMO; el sitio pide más para mostrar toda la cartelera.
  const limite = Math.max(filtros.limite ?? 20, 1);
  const tipo = filtros.tipo ?? "musica";

  const condiciones: Prisma.EventoWhereInput[] = [
    { activo: true },
    // El evento termina después de `desde`... (los de varios días cuentan si se cruzan con el rango)
    { OR: [{ fechaFin: { gte: desde } }, { fechaFin: null, fechaInicio: { gte: desde } }] },
  ];
  // ...y empieza antes de `hasta`.
  if (filtros.hasta) condiciones.push({ fechaInicio: { lte: filtros.hasta } });

  if (!filtros.incluirAgotados) condiciones.push({ OR: [{ agotado: false }, { agotado: null }] });

  if (tipo === "musica") condiciones.push({ categoria: CATEGORIA_MUSICA });
  if (tipo === "otros") condiciones.push({ categoria: { not: CATEGORIA_MUSICA } });

  let eventos = await prisma.evento.findMany({
    where: { AND: condiciones },
    orderBy: [{ fechaInicio: "asc" }, { hora: "asc" }],
    include: { recinto: true, sectores: true, fuente: true },
  });

  // Precio, género y texto se filtran acá y no en la base: el precio usa la
  // misma regla que el sitio (src/lib/precios.ts), y género y texto comparan
  // sin tildes ni mayúsculas sin depender de extensiones de PostgreSQL. Con
  // cientos de eventos es instantáneo; si llegan a ser miles, pasarlo a la consulta.
  const rango: RangoPrecio = { min: filtros.precioMin, max: filtros.precioMax };
  if (hayRango(rango)) {
    eventos = eventos.filter((e) =>
      calzaPrecio(e.sectores, { baseDesde: e.precioBaseMin, totalDesde: e.precioTotalMin, totalHasta: e.precioTotalMax }, rango, tipoPrecio),
    );
  }
  if (filtros.genero) {
    const g = normalizar(filtros.genero);
    eventos = eventos.filter((e) => e.generoOriginal && normalizar(e.generoOriginal).includes(g));
  }
  if (filtros.texto) {
    const t = normalizar(filtros.texto);
    eventos = eventos.filter((e) => normalizar(`${e.nombre} ${e.artista ?? ""} ${e.descripcion ?? ""}`).includes(t));
  }

  // Un mismo evento puede venderse en dos ticketeras: se muestra uno solo.
  const otrasFuentes = unirDuplicados(eventos);
  eventos = eventos.filter((e) => otrasFuentes.has(e.id));

  // Orden: por fecha, pero las temporadas largas (exposiciones, obras en
  // cartelera) que ya empezaron van según su fecha de término; si no,
  // quedarían todas al principio de la lista.
  const clave = (e: (typeof eventos)[number]) => {
    const inicio = e.fechaInicio ?? "9999-12-31";
    const fin = e.fechaFin ?? inicio;
    const temporadaLarga = Date.parse(fin) - Date.parse(inicio) > 7 * 86_400_000;
    return temporadaLarga && inicio < desde ? fin : inicio;
  };
  eventos.sort((a, b) => clave(a).localeCompare(clave(b)) || (a.hora ?? "99").localeCompare(b.hora ?? "99"));

  const total = eventos.length;
  return {
    total,
    filtros: { ...filtros, desde, tipoPrecio, tipo, limite },
    eventos: eventos.slice(0, limite).map((e) => formatearEvento(e, tipoPrecio, rango, otrasFuentes.get(e.id))),
  };
}

// ── Eventos repetidos entre fuentes ─────────────────────────────────────

interface OtraFuente {
  fuente: string;
  url: string;
}

// Palabras que no ayudan a distinguir un evento de otro.
const PALABRAS_COMUNES = new Set(
  "de del la las los el en con y the a al por para un una tour live en vivo presenta presentan show concierto santiago chile gira world".split(" "),
);

function palabrasClave(nombre: string): Set<string> {
  return new Set(
    normalizar(nombre)
      .replace(/[^a-z0-9ñ ]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length > 2 && !PALABRAS_COMUNES.has(p) && !/^20\d\d$/.test(p)),
  );
}

function mismoNombre(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  const comunes = [...a].filter((p) => b.has(p)).length;
  const menor = Math.min(a.size, b.size);
  // La mayoría de las palabras del nombre más corto ("Inti-Illimani" ⊂ "Inti-Illimani en el Teatro Oriente").
  return comunes >= Math.max(1, Math.ceil(menor * 0.7)) && (menor > 1 || comunes === Math.max(a.size, b.size));
}

// Preferencia cuando hay empate: las que informan más (sectores, disponibilidad).
const PRIORIDAD_FUENTE = ["ticketmaster", "puntoticket", "ticketplus", "lascondes", "vitacura", "lareina"];

// Agrupa los eventos repetidos (mismo día, misma comuna y hora si ambas se
// conocen, y casi el mismo nombre) y elige uno por grupo: el que tiene más
// precios por sector. Devuelve los elegidos (id → las otras fuentes); los que
// no aparecen en el mapa son duplicados y se ocultan.
function unirDuplicados(eventos: EventoConRelaciones[]): Map<number, OtraFuente[]> {
  const elegidos = new Map<number, OtraFuente[]>();
  const porDia = new Map<string, EventoConRelaciones[]>();
  for (const e of eventos) {
    const dia = e.fechaInicio ?? `sin-fecha-${e.id}`;
    porDia.set(dia, [...(porDia.get(dia) ?? []), e]);
  }

  for (const delDia of porDia.values()) {
    const grupos: EventoConRelaciones[][] = [];
    for (const e of delDia) {
      const claves = palabrasClave(e.nombre);
      const grupo = grupos.find((g) =>
        g.some(
          (o) =>
            o.fuenteId !== e.fuenteId &&
            (!o.hora || !e.hora || o.hora === e.hora) &&
            (!o.recinto?.comuna || !e.recinto?.comuna || ubicarComuna(o.recinto.comuna).comuna === ubicarComuna(e.recinto.comuna).comuna) &&
            mismoNombre(claves, palabrasClave(o.nombre)),
        ),
      );
      if (grupo) grupo.push(e);
      else grupos.push([e]);
    }
    for (const g of grupos) {
      const [mejor, ...otros] = [...g].sort(
        (a, b) =>
          b.sectores.length - a.sectores.length ||
          Number(b.precioBaseMin != null || b.precioTotalMin != null) - Number(a.precioBaseMin != null || a.precioTotalMin != null) ||
          PRIORIDAD_FUENTE.indexOf(a.fuenteId) - PRIORIDAD_FUENTE.indexOf(b.fuenteId),
      );
      elegidos.set(mejor.id, otros.map((o) => ({ fuente: o.fuente.nombre, url: o.url })));
    }
  }
  return elegidos;
}

type EventoConRelaciones = Prisma.EventoGetPayload<{ include: { recinto: true; sectores: true; fuente: true } }>;

function formatearEvento(e: EventoConRelaciones, tipoPrecio: TipoPrecio, rango: RangoPrecio = {}, tambienEn: OtraFuente[] = []) {
  const sectores = e.sectores
    .map((s) => ({ nombre: s.nombre, precio: s.precio, cargo: s.cargo, total: s.total, agotado: s.agotado }))
    .filter((s) => !hayRango(rango) || sectorEnRango(s, rango, tipoPrecio))
    .sort((a, b) => (a.total ?? 0) - (b.total ?? 0));

  return {
    id: e.id,
    nombre: e.nombre,
    artista: e.artista,
    categoria: e.categoria,
    genero: e.generoOriginal,
    descripcion: e.descripcion,
    fecha: e.fechaInicio,
    fechaFin: e.fechaFin !== e.fechaInicio ? e.fechaFin : null,
    hora: e.hora,
    recinto: e.recinto && {
      nombre: e.recinto.nombre,
      // Nombre de comuna unificado ("Santiago Centro" → "Santiago") y su región.
      ...ubicarComuna(e.recinto.comuna),
      direccion: e.recinto.direccion,
      latitud: e.recinto.latitud,
      longitud: e.recinto.longitud,
    },
    precios: {
      moneda: e.moneda ?? "CLP",
      baseDesde: e.precioBaseMin,
      totalDesde: e.precioTotalMin,
      totalHasta: e.precioTotalMax,
    },
    // Si se filtró por precio, solo los sectores que calzan con el rango.
    sectores,
    preciosEnImagen: e.imagenPreciosUrl,
    agotado: e.agotado,
    url: e.url,
    imagen: e.imagenUrl,
    fuente: { id: e.fuente.id, nombre: e.fuente.nombre },
    // El mismo evento en otras ticketeras (ver unirDuplicados).
    tambienEn,
    actualizado: e.detalleActualizadoEn?.toISOString() ?? null,
  };
}

export type EventoEncontrado = ReturnType<typeof formatearEvento>;
