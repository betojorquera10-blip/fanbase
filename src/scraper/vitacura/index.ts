// ============================================================================
// Corporación Cultural de Vitacura (vitacuracultura.cl) — SIN IA.
//
// LISTADO: la página /actividades/ muestra todas las actividades vigentes
//   (una sola página, sin paginar). Cada tarjeta enlaza a /evento/<nombre>/.
// DETALLE: cada página de evento tiene una estructura fija:
//   - a.tipo-evento           categoría ("Música", "Actividades familiares"...)
//   - .fx-entry-content h5    fecha, lugar y modalidad, separados por <br>:
//                             "Sábado 24 de octubre | 16:00 a 21:00 horas<br>
//                              Parque Bicentenario<br>Presencial / Gratuito"
//   - .fx-price               precio ("Entrada liberada", "$5.000"...)
//   - .fx-locations li        dirección (data-title) y coordenadas (lat, lng)
//
// La fecha es texto libre: se lee con el mismo lector de fechas en español
// que la agenda de Las Condes. Lo que no tiene fecha concreta ("Miércoles,
// 17:00 horas", "Todo el año") se descarta y queda anotado en paginas_fuente.
// ============================================================================

import * as cheerio from "cheerio";
import { hoyEnChile, normalizar } from "@/lib/fechas";
import { descargarHtml } from "@/scraper/http";
import { clasificar } from "@/scraper/clasificar";
import { meta, textoPlano } from "@/scraper/extraer";
import { parsearFechas, parsearPrecios, tituloLegible } from "@/scraper/lascondes/parse";
import { sincronizarPorPaginas, type FuentePorPaginas, type OpcionesPorPaginas, type PaginaListada, type ResultadoPagina } from "@/scraper/paginas";

const COMUNA = "Vitacura";

async function listar(urlActividades: string): Promise<PaginaListada[]> {
  const $ = cheerio.load(await descargarHtml(urlActividades));
  const paginas = new Map<string, PaginaListada>();
  $("#actividadesajax .evento").each((_, tarjeta) => {
    const url = $(tarjeta).find("a.cover").attr("href");
    if (!url?.includes("/evento/")) return;
    const categorias = $(tarjeta).find(".tipos-evento > *").map((_, c) => $(c).text().trim()).get().filter(Boolean);
    paginas.set(url, { url, categoria: categorias.join(" / ") || undefined });
  });
  return [...paginas.values()];
}

// Líneas de un elemento separadas por <br>.
function lineas($: cheerio.CheerioAPI, el: ReturnType<cheerio.CheerioAPI>): string[] {
  const html = (el.html() ?? "").replace(/<br\s*\/?>/gi, "\n");
  return cheerio.load(`<div>${html}</div>`)("div").text().split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function leer(html: string, pagina: { url: string; categoria: string | null }): ResultadoPagina {
  const $ = cheerio.load(html);
  const titulo = $("h1").first().text().trim() || (meta($, "og:title") ?? "").replace(/\s*[-|].*Vitacura.*$/i, "").trim();
  if (!titulo) return { omitir: "sin título" };

  const categoriaSitio = $("a.tipo-evento").map((_, a) => $(a).text().trim()).get().join(" / ") || pagina.categoria || "";
  const info = lineas($, $(".fx-entry-content h5").first());
  const precioTexto = $(".fx-price").first().text().trim();
  const descripcion = textoPlano(meta($, "og:description"));

  const clase = clasificar([], categoriaSitio, titulo, descripcion ?? "");
  if ("omitir" in clase) return clase;

  // La fecha está en la primera línea; a veces con hora en la misma ("Sábado 24 de octubre | 16:00 horas").
  const hoy = hoyEnChile();
  const textoFecha = info.slice(0, 2).join(" / ");
  const fechas = parsearFechas(normalizar(textoFecha), hoy, Number(hoy.slice(5, 7)));
  if (typeof fechas === "string") return { omitir: `${fechas}: "${textoFecha}"` };

  const ubicacion = $(".fx-locations li").first();
  // El lugar es la primera línea que no es fecha, horario ni modalidad ("Parque Bicentenario, Alt. Espoz").
  const lineaLugar = info.slice(1).find((l) => !/\d{1,2}:\d{2}|horas|hrs|presencial|online|gratis|liberad|descuento/i.test(l));
  const lugar = lineaLugar?.split(",")[0]?.trim() || ubicacion.find("span.font-italic").text().trim() || "Vitacura";
  const lat = Number(ubicacion.attr("lat"));
  const lng = Number(ubicacion.attr("lng"));
  // "Presencial / Gratis" en la tercera línea, o el bloque de precio.
  const { sectores, precioBase } = parsearPrecios([precioTexto, ...info.slice(2)].filter(Boolean));
  const slug = pagina.url.replace(/\/$/, "").split("/").pop()!;

  return {
    eventos: fechas.map((f) => ({
      idExterno: fechas.length > 1 ? `${slug}/${f.inicio}` : slug,
      nombre: tituloLegible(titulo),
      categoria: clase.categoria,
      categoriaFuente: categoriaSitio || null,
      generoOriginal: clase.genero,
      descripcion,
      fechaInicio: f.inicio,
      fechaFin: f.fin,
      hora: f.hora,
      recinto: {
        nombre: lugar,
        comuna: COMUNA,
        direccion: ubicacion.attr("data-title") ?? null,
        latitud: Number.isFinite(lat) && lat !== 0 ? lat : null,
        longitud: Number.isFinite(lng) && lng !== 0 ? lng : null,
      },
      sectores: sectores.map((s) => ({ nombre: s.nombre, precio: s.precio, cargo: null, total: null, agotado: null })),
      precioBaseMin: precioBase,
      agotado: /agotad/i.test(precioTexto) ? true : null,
      url: pagina.url,
      imagenUrl: meta($, "og:image"),
    })),
  };
}

export const VITACURA: FuentePorPaginas = {
  id: "vitacura",
  listar,
  leer,
  pausaMs: 1500,
  limitePorCorrida: 100,
};

export const sincronizarVitacura = (opciones?: OpcionesPorPaginas) => sincronizarPorPaginas(VITACURA, opciones);
