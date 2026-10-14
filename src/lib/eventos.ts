// Búsqueda de eventos: la usan la API (/api/v1/eventos), el sitio y los
// scripts de consola, para que todos respondan exactamente lo mismo.

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Con qué precio se compara el presupuesto:
//   "base"  → precio de la entrada sin el cargo por servicio (por defecto)
//   "total" → precio + cargo por servicio de la ticketera
export type TipoPrecio = "base" | "total";

export interface FiltrosEventos {
  desde?: string; // "YYYY-MM-DD" — por defecto, hoy
  hasta?: string; // "YYYY-MM-DD"
  precioMax?: number; // CLP
  tipoPrecio?: TipoPrecio;
  genero?: string; // texto libre, ej. "rock" (ignora mayúsculas y tildes)
  texto?: string; // busca en nombre del evento y artista
  incluirAgotados?: boolean;
  limite?: number;
}

export const LIMITE_MAXIMO = 100;

// Fecha de hoy en Chile como "YYYY-MM-DD" (independiente de la zona horaria del servidor).
export function hoyEnChile(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`); // mediodía UTC: sumar días nunca cruza de fecha por horario de verano
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Fin de semana = viernes a domingo (en Chile los conciertos del viernes en la
// noche cuentan como "el fin de semana"). Si hoy ya es viernes, sábado o
// domingo, devuelve el fin de semana en curso, desde hoy.
export function proximoFinDeSemana(hoy = hoyEnChile()): { desde: string; hasta: string } {
  const diaSemana = new Date(`${hoy}T12:00:00Z`).getUTCDay(); // 0 = domingo ... 6 = sábado
  if (diaSemana === 0) return { desde: hoy, hasta: hoy };
  if (diaSemana >= 5) return { desde: hoy, hasta: sumarDias(hoy, 7 - diaSemana) };
  return { desde: sumarDias(hoy, 5 - diaSemana), hasta: sumarDias(hoy, 7 - diaSemana) };
}

// "Electrónica" → "electronica", para comparar sin importar tildes ni mayúsculas.
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export async function buscarEventos(filtros: FiltrosEventos = {}) {
  const tipoPrecio = filtros.tipoPrecio ?? "base";
  const desde = filtros.desde ?? hoyEnChile();
  const limite = Math.min(Math.max(filtros.limite ?? 20, 1), LIMITE_MAXIMO);

  const condiciones: Prisma.EventoWhereInput[] = [
    { activo: true },
    // El evento termina después de `desde`... (los de varios días cuentan si se cruzan con el rango)
    { OR: [{ fechaFin: { gte: desde } }, { fechaFin: null, fechaInicio: { gte: desde } }] },
  ];
  // ...y empieza antes de `hasta`.
  if (filtros.hasta) condiciones.push({ fechaInicio: { lte: filtros.hasta } });

  if (!filtros.incluirAgotados) condiciones.push({ OR: [{ agotado: false }, { agotado: null }] });

  if (filtros.precioMax != null) {
    if (tipoPrecio === "total") {
      condiciones.push({ precioTotalMin: { lte: filtros.precioMax } });
    } else {
      // Algunas páginas no muestran el precio base (solo el total, o la tabla
      // está en una imagen). Para esos usamos el total: como total >= base, si
      // el total cabe en el presupuesto, el precio base también. Nunca se
      // muestra un evento que no calce; a lo más se omite alguno dudoso.
      condiciones.push({
        OR: [
          { precioBaseMin: { lte: filtros.precioMax } },
          { precioBaseMin: null, precioTotalMin: { lte: filtros.precioMax } },
        ],
      });
    }
  }

  let eventos = await prisma.evento.findMany({
    where: { AND: condiciones },
    orderBy: [{ fechaInicio: "asc" }, { hora: "asc" }],
    include: { recinto: true, sectores: true },
  });

  // Género y texto se filtran acá y no en la base: SQLite no compara sin
  // tildes ni mayúsculas. Con PostgreSQL esto pasará a la consulta.
  if (filtros.genero) {
    const g = normalizar(filtros.genero);
    eventos = eventos.filter((e) => e.generoOriginal && normalizar(e.generoOriginal).includes(g));
  }
  if (filtros.texto) {
    const t = normalizar(filtros.texto);
    eventos = eventos.filter((e) => normalizar(`${e.nombre} ${e.artista ?? ""}`).includes(t));
  }

  const total = eventos.length;
  return {
    total,
    filtros: { ...filtros, desde, tipoPrecio, limite },
    eventos: eventos.slice(0, limite).map((e) => formatearEvento(e, tipoPrecio, filtros.precioMax)),
  };
}

type EventoConRelaciones = Prisma.EventoGetPayload<{ include: { recinto: true; sectores: true } }>;

function formatearEvento(e: EventoConRelaciones, tipoPrecio: TipoPrecio, precioMax?: number) {
  const precioDe = (s: { precio: number | null; total: number | null }) => (tipoPrecio === "base" ? s.precio : s.total);
  const sectores = e.sectores
    .map((s) => ({ nombre: s.nombre, precio: s.precio, cargo: s.cargo, total: s.total }))
    .filter((s) => precioMax == null || (precioDe(s) ?? s.total ?? Infinity) <= precioMax)
    .sort((a, b) => (a.total ?? 0) - (b.total ?? 0));

  return {
    id: e.id,
    nombre: e.nombre,
    artista: e.artista,
    genero: e.generoOriginal,
    fecha: e.fechaInicio,
    fechaFin: e.fechaFin !== e.fechaInicio ? e.fechaFin : null,
    hora: e.hora,
    recinto: e.recinto && {
      nombre: e.recinto.nombre,
      comuna: e.recinto.comuna || null,
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
    // Si se filtró por precio, solo los sectores que calzan con el presupuesto.
    sectores,
    preciosEnImagen: e.imagenPreciosUrl,
    agotado: e.agotado,
    url: e.url,
    actualizado: e.detalleActualizadoEn?.toISOString() ?? null,
  };
}
