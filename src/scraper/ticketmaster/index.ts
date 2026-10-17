// ============================================================================
// Ticketmaster Chile (ticketmaster.cl) — SIN IA.
//
// LISTADO: las secciones /page/musica, /page/artes-y-teatro y
//   /page/ferias-y-expo enlazan a cada evento (../event/<nombre>). La sección
//   define la categoría. Deportes no se incluye.
// DETALLE: cada página trae
//   - un bloque schema.org Event (nombre, recinto, comuna),
//   - <meta property="og:image"> (afiche),
//   - el JSON de la aplicación con "venue" (dirección y coordenadas) y "shows":
//     cada función con su fecha en UTC y sus sectores, cada sector con sus
//     tarifas (precio, cargo por servicio y si está disponible).
//
// Cada función es un evento en FanBase (idExterno "<nombre>/<id función>").
// Las tarifas con código (ej. "30% Dcto. Vecino Providencia", piden RUT) no se
// guardan: no están disponibles para el público general.
// ============================================================================

import * as cheerio from "cheerio";
import { CATEGORIA_MUSICA } from "@/lib/categorias";
import { hoyEnChile, normalizar } from "@/lib/fechas";
import { descargarHtml, esperar } from "@/scraper/http";
import { extraerJson, fechaHoraChile, leerJsonLd, meta, textoPlano, tiposDe } from "@/scraper/extraer";
import { parsearFechas } from "@/scraper/lascondes/parse";
import { sincronizarPorPaginas, type FuentePorPaginas, type OpcionesPorPaginas, type PaginaListada, type ResultadoPagina, type SectorLeido } from "@/scraper/paginas";

const BASE = "https://www.ticketmaster.cl";

// Sección del sitio → categoría en FanBase. La primera que lista un evento gana.
const SECCIONES: [string, string][] = [
  ["musica", CATEGORIA_MUSICA],
  ["artes-y-teatro", "Teatro"],
  ["ferias-y-expo", "Ferias y festivales"],
];

async function listar(): Promise<PaginaListada[]> {
  const paginas = new Map<string, PaginaListada>();
  for (const [i, [seccion, categoria]] of SECCIONES.entries()) {
    if (i > 0) await esperar(1500);
    const html = await descargarHtml(`${BASE}/page/${seccion}`);
    for (const [, slug] of html.matchAll(/"(?:\.\.|https:\/\/www\.ticketmaster\.cl)\/event\/([a-z0-9-]+)"/g)) {
      const url = `${BASE}/event/${slug}`;
      if (!paginas.has(url)) paginas.set(url, { url, categoria });
    }
  }
  return [...paginas.values()];
}

interface Tarifa {
  name: string;
  price: number | null;
  serviceChargeAmount: number | null;
  available: boolean;
  passcodeRequired: boolean;
  isHiddenUntilUnlock: boolean;
}
interface SectorTM {
  name: string;
  available: boolean;
  rates?: Tarifa[];
}
interface Funcion {
  id: number;
  startDate: string;
  endDate?: string | null;
  available: boolean;
  sectors?: SectorTM[];
}
interface Venue {
  name?: string;
  address?: { city?: string; latitude?: number; longitude?: number; formatReadableSimple?: string };
}

// En "Artes y teatro" también hay humor y danza.
function refinarCategoria(categoria: string, nombre: string): string {
  if (categoria !== "Teatro") return categoria;
  const n = normalizar(nombre);
  if (/stand ?up|humor|comedia|comediante/.test(n)) return "Humor";
  if (/ballet|danza/.test(n)) return "Danza";
  return categoria;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Obras en temporada que solo dicen el mes: "Octubre 2026" → del 1 (o desde hoy) al último día del mes.
function temporadaDelMes(texto: string, hoy: string) {
  const m = normalizar(texto).match(/^(\p{L}+) (\d{4})$/u);
  const mes = m ? MESES.indexOf(m[1]) + 1 : 0;
  if (!m || mes === 0) return null;
  const primero = `${m[2]}-${String(mes).padStart(2, "0")}-01`;
  const ultimo = new Date(Date.UTC(Number(m[2]), mes, 0)).toISOString().slice(0, 10);
  if (ultimo < hoy) return null;
  const inicio = primero < hoy ? hoy : primero;
  return { inicio, fin: ultimo, hora: null, dia: Number(inicio.slice(8)) };
}

function sectoresDe(f: Funcion): SectorLeido[] {
  const sectores: SectorLeido[] = [];
  for (const s of f.sectors ?? []) {
    const publicas = (s.rates ?? []).filter((r) => !r.passcodeRequired && !r.isHiddenUntilUnlock && r.price != null);
    for (const r of publicas) {
      const cargo = r.serviceChargeAmount ?? null;
      sectores.push({
        // "Platea Baja General", o "Platea Baja General – Estudiante" si hay más de una tarifa pública.
        nombre: publicas.length > 1 && r.name !== "Normal" ? `${s.name} – ${r.name}` : s.name,
        precio: r.price,
        cargo,
        total: r.price! + (cargo ?? 0),
        agotado: !(s.available && r.available && f.available),
      });
    }
  }
  return sectores;
}

function leer(html: string, pagina: { url: string; categoria: string | null }): ResultadoPagina {
  const $ = cheerio.load(html);
  const ld = leerJsonLd(html).find((o) => tiposDe(o).some((t) => t.endsWith("Event")));
  const nombre = (typeof ld?.name === "string" ? ld.name : null) ?? meta($, "og:title");
  if (!nombre) return { omitir: "sin nombre de evento" };

  const venue = extraerJson<Venue>(html, "venue") ?? {};
  const lugarLd = (ld?.location ?? {}) as { name?: string; address?: { addressLocality?: string; streetAddress?: string } };
  const nombreRecinto = venue.name ?? lugarLd.name;
  const recinto = nombreRecinto
    ? {
        nombre: nombreRecinto,
        comuna: venue.address?.city ?? lugarLd.address?.addressLocality ?? "",
        direccion: venue.address?.formatReadableSimple ?? lugarLd.address?.streetAddress ?? null,
        latitud: venue.address?.latitude ?? null,
        longitud: venue.address?.longitude ?? null,
      }
    : null;

  // La descripción del schema.org suele ser solo la fecha ("6 de Diciembre 2026"): se usa si es más larga.
  const descripcion = typeof ld?.description === "string" && ld.description.length > 40 ? textoPlano(ld.description) : null;
  const slug = pagina.url.slice(pagina.url.lastIndexOf("/") + 1);
  const categoria = refinarCategoria(pagina.categoria ?? CATEGORIA_MUSICA, nombre);
  const imagenUrl = meta($, "og:image");

  const funciones = (extraerJson<Funcion[]>(html, "shows") ?? []).filter((f) => f.startDate);
  if (funciones.length === 0) {
    // Eventos grandes (ej. estadios) a veces no publican las funciones en la
    // página, pero sí la fecha como texto: "21 y 22 de Noviembre 2026".
    const textoFecha = typeof ld?.description === "string" ? ld.description : (meta($, "og:description") ?? "");
    const hoy = hoyEnChile();
    const temporada = temporadaDelMes(textoFecha, hoy);
    const fechas = temporada ? [temporada] : parsearFechas(normalizar(textoFecha), hoy, Number(hoy.slice(5, 7)));
    if (typeof fechas === "string") return { omitir: `sin funciones ni fecha publicadas ("${textoFecha.slice(0, 60)}")` };
    return {
      eventos: fechas.map((o) => ({
        idExterno: fechas.length > 1 ? `${slug}/${o.inicio}` : slug,
        nombre: nombre.trim(),
        categoria,
        categoriaFuente: `sección ${pagina.categoria ?? "?"}`,
        fechaInicio: o.inicio,
        fechaFin: o.fin,
        hora: o.hora,
        recinto,
        sectores: [],
        agotado: null, // sin funciones publicadas no sabemos si queda algo
        url: pagina.url,
        imagenUrl,
      })),
    };
  }

  return {
    eventos: funciones.map((f) => {
      const { fecha, hora } = fechaHoraChile(f.startDate);
      const fin = f.endDate ? fechaHoraChile(f.endDate).fecha : fecha;
      const sectores = sectoresDe(f);
      return {
        idExterno: `${slug}/${f.id}`,
        nombre: nombre.trim(),
        categoria,
        categoriaFuente: `sección ${pagina.categoria ?? "?"}`,
        descripcion,
        fechaInicio: fecha,
        fechaFin: fin > fecha ? fin : fecha,
        hora,
        recinto,
        sectores,
        agotado: !f.available || (sectores.length > 0 && sectores.every((s) => s.agotado)),
        url: pagina.url,
        imagenUrl,
      };
    }),
  };
}

export const TICKETMASTER: FuentePorPaginas = {
  id: "ticketmaster",
  listar,
  leer,
  pausaMs: 1500,
  limitePorCorrida: 150,
};

export const sincronizarTicketmaster = (opciones?: OpcionesPorPaginas) => sincronizarPorPaginas(TICKETMASTER, opciones);
