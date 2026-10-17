// Utilidades para sacar datos de páginas HTML, compartidas por los scrapers.

import * as cheerio from "cheerio";

type Json = Record<string, unknown>;

// Todos los objetos schema.org de los <script type="application/ld+json">,
// aplanando listas y @graph. Los bloques mal formados se ignoran.
export function leerJsonLd(html: string): Json[] {
  const $ = cheerio.load(html);
  const objetos: Json[] = [];
  const agregar = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(agregar);
    else if (o && typeof o === "object") {
      const obj = o as Json;
      if (Array.isArray(obj["@graph"])) agregar(obj["@graph"]);
      else objetos.push(obj);
    }
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      agregar(JSON.parse($(el).text()));
    } catch {
      // bloque inválido: se ignora
    }
  });
  return objetos;
}

// "MusicEvent", ["Event", "Festival"] → lista de tipos.
export function tiposDe(o: Json): string[] {
  const t = o["@type"];
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === "string");
}

// El primer valor JSON (objeto o arreglo) que sigue a `"clave":` en el texto.
// Recorre respetando strings, así no lo confunden corchetes dentro de textos.
export function extraerJson<T = unknown>(texto: string, clave: string): T | null {
  const marca = `"${clave}":`;
  const i = texto.indexOf(marca);
  if (i < 0) return null;
  let inicio = i + marca.length;
  while (/\s/.test(texto[inicio])) inicio++;
  const abre = texto[inicio];
  if (abre !== "{" && abre !== "[") return null;

  let profundidad = 0;
  let enString = false;
  for (let k = inicio; k < texto.length; k++) {
    const c = texto[k];
    if (enString) {
      if (c === "\\") k++;
      else if (c === '"') enString = false;
    } else if (c === '"') enString = true;
    else if (c === "{" || c === "[") profundidad++;
    else if (c === "}" || c === "]") {
      profundidad--;
      if (profundidad === 0) {
        try {
          return JSON.parse(texto.slice(inicio, k + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const FORMATO_CHILE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Fecha ISO → fecha y hora en Chile. "2026-12-06T21:00:00Z" → 2026-12-06 18:00.
// Si no trae zona horaria ("2026-12-06T21:00"), ya es hora local.
export function fechaHoraChile(iso: string): { fecha: string; hora: string | null } {
  if (!/T\d/.test(iso)) return { fecha: iso.slice(0, 10), hora: null };
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(iso)) return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16) };
  const partes = Object.fromEntries(FORMATO_CHILE.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
}

// Texto plano de un HTML o texto con entidades; recorta a `maximo` caracteres.
export function textoPlano(html: string | null | undefined, maximo = 4000): string | null {
  if (!html) return null;
  const texto = cheerio.load(`<div>${html}</div>`)("div").text().replace(/\s+/g, " ").trim();
  return texto ? texto.slice(0, maximo) : null;
}

export function meta($: cheerio.CheerioAPI, propiedad: string): string | null {
  return $(`meta[property="${propiedad}"]`).attr("content") ?? $(`meta[name="${propiedad}"]`).attr("content") ?? null;
}
