// ============================================================================
// Ticketplus (ticketplus.cl) — SIN IA.
//
// LISTADO: el sitemap (https://ticketplus.cl/sitemap.xml) trae todas las
//   páginas /events/... con su fecha de última modificación. Se descartan de
//   entrada los abonos y las funciones con fecha pasada en la dirección.
// DETALLE: cada página trae un bloque schema.org estándar (MusicEvent,
//   TheaterEvent...) con fecha y hora, recinto con comuna y coordenadas,
//   precio mínimo y máximo, y si está agotado. La categoría propia de
//   Ticketplus viene en <meta property="og:product:category">.
//
// Ticketplus no publica los precios por tipo de entrada en el HTML (los carga
// desde su API, que su robots.txt pide no usar): se guarda el rango desde–hasta.
// ============================================================================

import * as cheerio from "cheerio";
import { hoyEnChile } from "@/lib/fechas";
import { clasificar } from "@/scraper/clasificar";
import { descargarHtml } from "@/scraper/http";
import { fechaHoraChile, leerJsonLd, meta, textoPlano, tiposDe } from "@/scraper/extraer";
import { sincronizarPorPaginas, type EventoLeido, type FuentePorPaginas, type OpcionesPorPaginas, type PaginaListada, type ResultadoPagina } from "@/scraper/paginas";

// Se re-exporta para los scripts que reclasifican con datos guardados.
export { clasificar };

const RE_NO_EVENTO = /abono|abonad|socio|membres/; // se descartan sin descargarlas

async function listar(urlSitemap: string): Promise<PaginaListada[]> {
  const xml = await descargarHtml(urlSitemap);
  const hoy = hoyEnChile();
  const paginas: PaginaListada[] = [];
  for (const [, url, lastmod] of xml.matchAll(/<loc>(https:\/\/ticketplus\.cl\/events\/[^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)) {
    const slug = url.slice(url.lastIndexOf("/") + 1);
    if (RE_NO_EVENTO.test(slug)) continue;
    // Funciones con fecha en la dirección: "...-2025-10-21-12-00-00-0300".
    const fecha = slug.match(/(\d{4}-\d{2}-\d{2})-\d{2}-\d{2}-\d{2}-\d{4}$/)?.[1];
    if (fecha && fecha < hoy) continue;
    paginas.push({ url, modificadaEn: lastmod ? new Date(lastmod) : undefined });
  }
  return paginas;
}

// Muchos eventos de Ticketplus traen el tipo genérico "Event" y la categoría
// vacía, así que también se mira el nombre y la descripción.
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : null);
const numero = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Math.round(Number(v)));

function leer(html: string, pagina: { url: string }): ResultadoPagina {
  const $ = cheerio.load(html);
  const evento = leerJsonLd(html).find((o) => tiposDe(o).some((t) => t.endsWith("Event") || t === "Festival"));
  if (!evento) return { omitir: "sin datos de evento (schema.org)" };

  const nombre = texto(evento.name);
  const inicio = texto(evento.startDate);
  if (!nombre || !inicio) return { omitir: "sin nombre o fecha" };
  if (/cancel/i.test(String(evento.eventStatus ?? ""))) return { omitir: "evento cancelado" };
  if (/online/i.test(String(evento.eventAttendanceMode ?? ""))) return { omitir: "evento online" };

  const lugar = (evento.location ?? {}) as Record<string, unknown>;
  const direccion = (lugar.address ?? {}) as Record<string, unknown>;
  const pais = texto(direccion.addressCountry);
  if (pais && pais.toUpperCase() !== "CL" && !/chile/i.test(pais)) return { omitir: `fuera de Chile (${pais})` };


  const descripcion = textoPlano(texto(evento.description));
  const categoriaTicketplus = meta($, "og:product:category") ?? "";
  // El recinto también ayuda a clasificar (ej. "Planetario Huechuraba").
  const clase = clasificar(tiposDe(evento), categoriaTicketplus, nombre, `${descripcion ?? ""} ${texto(lugar.name) ?? ""}`);
  if ("omitir" in clase) return clase;

  const { fecha, hora } = fechaHoraChile(inicio);
  const fin = texto(evento.endDate) ? fechaHoraChile(texto(evento.endDate)!).fecha : fecha;
  const geo = (lugar.geo ?? {}) as Record<string, unknown>;
  const ofertas = (Array.isArray(evento.offers) ? evento.offers[0] : evento.offers ?? {}) as Record<string, unknown>;
  const disponibilidad = String(ofertas.availability ?? "");

  const e: EventoLeido = {
    idExterno: pagina.url.slice(pagina.url.lastIndexOf("/") + 1),
    // Ticketplus publica algunos nombres con separadores dañados: "JAZZ CLUB ? MIERCOLES".
    // y "Concierto N?6", "45? Aniversario" en vez de "N°6", "45° Aniversario".
    nombre: nombre.replace(/\s+\?\s+/g, " · ").replace(/(\d|\bN)\?/g, "$1°").replace(/\s+/g, " "),
    categoria: clase.categoria,
    categoriaFuente: [...tiposDe(evento), categoriaTicketplus].filter(Boolean).join(" · ") || null,
    generoOriginal: clase.genero,
    descripcion,
    fechaInicio: fecha,
    fechaFin: fin > fecha ? fin : fecha,
    hora,
    recinto: texto(lugar.name)
      ? {
          nombre: texto(lugar.name)!,
          comuna: texto(direccion.addressLocality) ?? "",
          direccion: texto(direccion.streetAddress),
          latitud: geo.latitude != null ? Number(geo.latitude) : null,
          longitud: geo.longitude != null ? Number(geo.longitude) : null,
        }
      : null,
    sectores: [],
    // No sabemos si incluye el cargo por servicio: se guarda como total (el
    // filtro "precio base" usa el total cuando no hay base).
    precioTotalMin: numero(ofertas.lowPrice ?? ofertas.price),
    precioTotalMax: numero(ofertas.highPrice ?? ofertas.price),
    agotado: /soldout/i.test(disponibilidad) ? true : /instock|limited/i.test(disponibilidad) ? false : null,
    url: pagina.url,
    imagenUrl: texto(evento.image) ?? meta($, "og:image"),
  };
  return { eventos: [e] };
}

export const TICKETPLUS: FuentePorPaginas = {
  id: "ticketplus",
  listar,
  leer,
  pausaMs: 1500,
  limitePorCorrida: 250,
};

export const sincronizarTicketplus = (opciones?: OpcionesPorPaginas) => sincronizarPorPaginas(TICKETPLUS, opciones);
