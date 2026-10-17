// ============================================================================
// Corporación Cultural de La Reina (culturalareina.cl) — SIN IA.
//
// LISTADO: el sitemap de eventos (evento-sitemap.xml) con la fecha de última
//   modificación de cada página: solo se releen las nuevas o modificadas.
// DETALLE: cada evento se publica como una noticia (Elementor). La fecha, el
//   lugar y el precio suelen ir en el resumen (<meta name="description">) o
//   en los primeros párrafos:
//     "Sábado 24 de octubre · 19:30 horas · Plaza de la Casona Nemesio Antúnez
//      | Carlos Ossandón, esquina avenida ... · Entrada liberada."
//   La categoría está en el título "Revisa más eventos relacionados a CONCIERTO".
//
// Las fechas son texto libre: se leen con el lector de fechas en español de
// la agenda de Las Condes. Lo que no tiene una fecha concreta ("todos los
// miércoles de octubre") se descarta y queda anotado en paginas_fuente.
// ============================================================================

import * as cheerio from "cheerio";
import { hoyEnChile, normalizar } from "@/lib/fechas";
import { descargarHtml } from "@/scraper/http";
import { clasificar } from "@/scraper/clasificar";
import { meta } from "@/scraper/extraer";
import { parsearFechas, parsearPrecios } from "@/scraper/lascondes/parse";
import { sincronizarPorPaginas, type FuentePorPaginas, type OpcionesPorPaginas, type PaginaListada, type ResultadoPagina } from "@/scraper/paginas";

const COMUNA = "La Reina";

// Recintos de la Corporación (pie de página del sitio), para reconocer el lugar en el texto.
const RECINTOS: { patron: RegExp; nombre: string; direccion: string }[] = [
  { patron: /sala nemesio/, nombre: "Sala Nemesio", direccion: "Av. Alcalde Fernando Castillo Velasco 8580" },
  { patron: /casona nemesio|nemesio antunez/, nombre: "Casona Nemesio Antúnez", direccion: "Carlos Ossandón 11" },
  { patron: /biblioteca/, nombre: "Biblioteca Pública de La Reina", direccion: "Av. Alcalde Fernando Castillo Velasco 8580" },
  { patron: /vicente bianchi/, nombre: "Centro Cultural Vicente Bianchi", direccion: "Santa Rita 1153" },
];

async function listar(urlSitemap: string): Promise<PaginaListada[]> {
  const xml = await descargarHtml(urlSitemap);
  return [...xml.matchAll(/<loc>(https:\/\/culturalareina\.cl\/evento\/[^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)].map(
    ([, url, lastmod]) => ({ url, modificadaEn: lastmod ? new Date(lastmod) : undefined }),
  );
}

function leer(html: string, pagina: { url: string }): ResultadoPagina {
  const $ = cheerio.load(html);
  const titulo = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (!titulo) return { omitir: "sin título" };

  // Categoría: el título que sigue a "Revisa más eventos relacionados a".
  const encabezados = $("h2").map((_, h) => $(h).text().trim()).get();
  const iRelacionados = encabezados.findIndex((t) => /relacionados a/i.test(t));
  const categoriaSitio = iRelacionados >= 0 ? (encabezados[iRelacionados + 1] ?? "") : "";

  const resumen = meta($, "description") ?? meta($, "og:description") ?? "";
  const parrafos = $(".elementor-widget-theme-post-content p, .elementor-widget-text-editor p")
    .map((_, p) => $(p).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.length > 10);
  const descripcion = parrafos.join("\n\n").slice(0, 4000) || null;

  const clase = clasificar([], categoriaSitio, titulo, `${resumen} ${descripcion ?? ""}`);
  if ("omitir" in clase) return clase;

  // La fecha: el primer párrafo donde se entienda una fecha, o el resumen (que
  // a veces viene cortado: "...el viernes 23 y sábado").
  // Los textos no dicen el año ("sábado 24 de octubre") y el sitemap conserva
  // eventos antiguos: el año se deduce desde cuándo se publicó la página, que
  // se ve en la ruta de su imagen (/wp-content/uploads/2025/10/...).
  const subida = (meta($, "og:image") ?? "").match(/\/uploads\/(\d{4})\/(\d{2})\//);
  const hoy = subida ? `${subida[1]}-${subida[2]}-15` : hoyEnChile();
  const mes = Number(hoy.slice(5, 7));
  let textoFecha = "";
  let fechas: ReturnType<typeof parsearFechas> = "sin fecha";
  for (const texto of [...parrafos.slice(0, 6), resumen]) {
    const r = parsearFechas(normalizar(texto), hoy, mes);
    if (typeof r !== "string") {
      fechas = r;
      textoFecha = texto;
      break;
    }
  }
  if (typeof fechas === "string") return { omitir: `sin fecha concreta: "${(resumen || parrafos[0] || "").slice(0, 80)}"` };

  const contexto = normalizar(`${textoFecha} ${resumen} ${parrafos.slice(0, 3).join(" ")}`);
  const recinto = RECINTOS.find((r) => r.patron.test(contexto));
  // Precio: "Entrada liberada", "$5.000 general"... en el texto de la fecha o en los primeros párrafos.
  const conPrecio = [textoFecha, resumen, ...parrafos.slice(0, 6)].filter((t) => /\$|liberad|gratuit|gratis/i.test(t));
  const { sectores, precioBase } = parsearPrecios(conPrecio.slice(0, 1));
  const slug = pagina.url.replace(/\/$/, "").split("/").pop()!;

  return {
    eventos: fechas.map((f) => ({
      idExterno: fechas.length > 1 ? `${slug}/${f.inicio}` : slug,
      nombre: titulo,
      categoria: clase.categoria,
      categoriaFuente: categoriaSitio || null,
      generoOriginal: clase.genero,
      descripcion,
      fechaInicio: f.inicio,
      fechaFin: f.fin,
      hora: f.hora,
      recinto: recinto
        ? { nombre: recinto.nombre, comuna: COMUNA, direccion: recinto.direccion }
        : { nombre: "Corporación Cultural de La Reina", comuna: COMUNA },
      sectores: sectores.map((s) => ({ nombre: s.nombre, precio: s.precio, cargo: null, total: null, agotado: null })),
      precioBaseMin: precioBase,
      agotado: null,
      url: pagina.url,
      imagenUrl: meta($, "og:image"),
    })),
  };
}

export const LA_REINA: FuentePorPaginas = {
  id: "lareina",
  listar,
  leer,
  pausaMs: 1500,
  limitePorCorrida: 200,
};

export const sincronizarLaReina = (opciones?: OpcionesPorPaginas) => sincronizarPorPaginas(LA_REINA, opciones);
