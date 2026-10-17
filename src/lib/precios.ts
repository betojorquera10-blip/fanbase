// Filtro por rango de precio, compartido por la API, el sitio y los scripts.
// Archivo aparte para que el navegador lo pueda usar sin cargar la base.
//
// Un evento tiene varios precios (cancha, platea...). Calza con el rango si
// ALGUNA de sus entradas cae dentro: quien busca "hasta $30.000" lo ve si la
// cancha le alcanza, aunque la platea cueste más.
//
// Los sectores marcados como agotados no cuentan. Solo Ticketmaster informa
// la disponibilidad por sector; en las demás fuentes un sector barato que se
// agotó puede seguir calzando, y la disponibilidad se confirma en la ticketera.

// Con qué precio se compara:
//   "base"  → precio de la entrada sin el cargo por servicio (por defecto)
//   "total" → precio + cargo por servicio de la ticketera
export type TipoPrecio = "base" | "total";

export interface RangoPrecio {
  min?: number; // CLP, incluido
  max?: number; // CLP, incluido
}

interface SectorConPrecio {
  precio: number | null;
  total: number | null;
  agotado?: boolean | null; // null = la fuente no lo informa
}

interface ResumenPrecios {
  baseDesde: number | null;
  totalDesde: number | null;
  totalHasta: number | null;
}

export const hayRango = (r: RangoPrecio) => r.min != null || r.max != null;

const enRango = (p: number, r: RangoPrecio) => (r.min == null || p >= r.min) && (r.max == null || p <= r.max);

// Algunas páginas muestran solo el total (o solo el base): se usa el que haya.
export const precioSector = (s: SectorConPrecio, tipo: TipoPrecio) =>
  tipo === "base" ? (s.precio ?? s.total) : (s.total ?? s.precio);

export function sectorEnRango(s: SectorConPrecio, rango: RangoPrecio, tipo: TipoPrecio): boolean {
  const p = precioSector(s, tipo);
  return s.agotado !== true && p != null && enRango(p, rango);
}

export function calzaPrecio(sectores: SectorConPrecio[], resumen: ResumenPrecios, rango: RangoPrecio, tipo: TipoPrecio = "base"): boolean {
  if (!hayRango(rango)) return true;
  if (sectores.length) return sectores.some((s) => sectorEnRango(s, rango, tipo));

  // Sin sectores (precios publicados como imagen, o entrada liberada): se usa
  // el rango "desde–hasta" del evento y basta con que se cruce con el buscado.
  const desde = tipo === "base" ? (resumen.baseDesde ?? resumen.totalDesde) : (resumen.totalDesde ?? resumen.baseDesde);
  if (desde == null) return false; // sin precio conocido: no se puede asegurar que calce
  const hasta = Math.max(resumen.totalHasta ?? desde, desde);
  return (rango.max == null || desde <= rango.max) && (rango.min == null || hasta >= rango.min);
}
