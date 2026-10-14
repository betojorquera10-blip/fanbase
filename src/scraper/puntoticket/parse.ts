// ============================================================================
// Parser de Puntoticket — convierte HTML en datos, SIN IA.
//
// Puntoticket entrega los datos bien estructurados, así que los leemos con
// selectores fijos (Cheerio). Costo por corrida en IA: $0.
//
// Si Puntoticket cambia su diseño, estas funciones devuelven listas vacías o
// campos nulos; el script que las llama debe detectarlo y avisar (no guardar
// una base vacía en silencio).
//
// Fuentes de datos:
//   LISTADO (/musica): <article class="event-item"> con ID, nombre, recinto,
//     género y fecha ISO dentro de getDate(['2027-03-18', '', '']).
//   DETALLE (página de cada evento):
//     - <script type="application/ld+json"> estándar schema.org/Event: fecha y
//       hora, dirección, coordenadas GPS, artista, rango de precios. Viene en
//       TODAS las plantillas observadas.
//     - Precios por sector, según la plantilla de la página:
//         a) <table class="tabla-precios-normal">: sector, precio, cargo, total.
//         b) <table id="tabla-sectores">: sector y precio total.
//         c) Páginas "especiales" con la tabla como imagen: sin sectores.
// ============================================================================

import * as cheerio from "cheerio";

export const BASE_URL = "https://www.puntoticket.com";

export interface EventoListado {
  idExterno: string; // ej. "PLS021" — ID interno de Puntoticket, estable entre corridas
  nombre: string;
  url: string; // URL absoluta a la página del evento
  recinto: string | null;
  comuna: string | null;
  generoOriginal: string | null; // tal como lo escribe Puntoticket: "J-Rock", "Romántico"...
  fechaInicio: string | null; // YYYY-MM-DD
  fechaFin: string | null; // YYYY-MM-DD (igual a fechaInicio si es de un solo día)
  imagenUrl: string | null;
}

export interface SectorPrecio {
  nombre: string; // "TRIBUNA", "CANCHA GENERAL"...
  precio: number | null; // precio base en CLP (algunas plantillas solo muestran el total)
  cargo: number | null; // cargo por servicio
  total: number | null; // precio + cargo
}

export interface EventoDetalle {
  inicio: string | null; // fecha y hora ISO, ej. "2027-03-18T21:00:00" (hora local de Chile)
  artista: string | null;
  urlCanonica: string | null;
  recinto: {
    nombre: string | null;
    direccion: string | null;
    comuna: string | null;
    latitud: number | null;
    longitud: number | null;
  };
  precioMin: number | null; // total más bajo, según schema.org
  precioMax: number | null;
  moneda: string | null;
  sectores: SectorPrecio[];
  // Algunas páginas "especiales" publican la tabla de precios como IMAGEN:
  // ahí no hay sectores que leer del HTML. Guardamos el link para poder
  // leerla más adelante (ej. con un modelo de visión, una sola vez por imagen).
  imagenPreciosUrl: string | null;
  agotado: boolean | null; // null = no se pudo determinar
}

// "$155.000" → 155000. Devuelve null si no hay número.
export function parsearPesos(texto: string): number | null {
  const digitos = texto.replace(/[^\d]/g, "");
  return digitos ? Number(digitos) : null;
}

function limpiar(texto: string | undefined | null): string | null {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  return t || null;
}

function urlAbsoluta(href: string | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, BASE_URL).toString();
  } catch {
    return null;
  }
}

// ── LISTADO ──────────────────────────────────────────────────────────────

export function parsearListado(html: string): EventoListado[] {
  const $ = cheerio.load(html);
  const eventos: EventoListado[] = [];

  $("article.event-item").each((_, el) => {
    const $el = $(el);
    const $a = $el.find("a").first();

    // data-ga-tracking="event, ListadoEventosCategoria, Click, EventoID:PLS021-ClienteID:0"
    const tracking = $a.attr("data-ga-tracking") ?? "";
    const idExterno = tracking.match(/EventoID:([A-Za-z0-9]+)/)?.[1] ?? null;

    const url = urlAbsoluta($a.attr("href"));
    const nombre = limpiar($el.find("h3").attr("title") ?? $el.find("h3").text());
    if (!idExterno || !url || !nombre) return; // tarjeta incompleta: se ignora

    // <p class="descripcion"><strong>Teatro Coliseo - Santiago Centro</strong> / J-Rock</p>
    const $desc = $el.find("p.descripcion");
    const lugar = limpiar($desc.find("strong").text());
    const generoOriginal = limpiar($desc.text().split("/").slice(1).join("/"));
    // El recinto y la comuna van separados por " - ", pero algunos recintos
    // tienen guiones en el nombre: la comuna es siempre la última parte.
    const partesLugar = lugar?.split(" - ") ?? [];
    const comuna = partesLugar.length > 1 ? partesLugar.pop()! : null;
    const recinto = partesLugar.length ? partesLugar.join(" - ") : null;

    // v-html="getDate(['2026-11-14', '2026-11-15', ''])"
    const fechas = ($el.find("p.fecha").attr("v-html") ?? "").match(/\d{4}-\d{2}-\d{2}/g) ?? [];
    const fechaInicio = fechas[0] ?? null;
    const fechaFin = fechas[1] ?? fechaInicio;

    eventos.push({
      idExterno,
      nombre,
      url,
      recinto,
      comuna,
      generoOriginal,
      fechaInicio,
      fechaFin,
      imagenUrl: $el.find("img.img--evento").attr("src") ?? null,
    });
  });

  return eventos;
}

// ── DETALLE ──────────────────────────────────────────────────────────────

interface SchemaEvent {
  "@type"?: string;
  name?: string;
  startDate?: string;
  url?: string;
  performer?: { name?: string } | { name?: string }[];
  offers?: { lowPrice?: number; highPrice?: number; PriceCurrency?: string; priceCurrency?: string };
  location?: {
    name?: string;
    geo?: { latitude?: number; longitude?: number };
    address?: { streetAddress?: string; addressLocality?: string };
  };
}

function leerSchemaEvent($: cheerio.CheerioAPI): SchemaEvent | null {
  let encontrado: SchemaEvent | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (encontrado) return;
    try {
      const data = JSON.parse($(el).text());
      const lista = Array.isArray(data) ? data : [data];
      encontrado = lista.find((d) => d?.["@type"] === "Event") ?? null;
    } catch {
      // JSON mal formado: lo ignoramos y seguimos con los demás bloques
    }
  });
  return encontrado;
}

function sinParametros(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString();
  } catch {
    return null;
  }
}

export function parsearDetalle(html: string): EventoDetalle {
  const $ = cheerio.load(html);
  const schema = leerSchemaEvent($);

  // Plantilla (a): sector | precio | cargo | total
  const sectores: SectorPrecio[] = [];
  $("table.tabla-precios-normal tbody tr").each((_, tr) => {
    const celdas = $(tr).find("td");
    if (celdas.length < 2) return;
    const nombre = limpiar(celdas.eq(0).text());
    const precio = parsearPesos(celdas.eq(1).text());
    if (!nombre || precio == null) return;
    sectores.push({
      nombre,
      precio,
      cargo: celdas.length > 2 ? parsearPesos(celdas.eq(2).text()) : null,
      total: celdas.length > 3 ? parsearPesos(celdas.eq(3).text()) : null,
    });
  });

  // Plantilla (b): sector | precio total
  if (sectores.length === 0) {
    $("table#tabla-sectores tr").each((_, tr) => {
      const nombre = limpiar($(tr).find(".sector").text());
      const total = parsearPesos($(tr).find("td.precio-total").text());
      if (nombre && total != null) sectores.push({ nombre, precio: null, cargo: null, total });
    });
  }

  // Plantilla (c): tabla de precios como imagen
  const imagenPrecios = $('img[alt*="precio" i], img[src*="precio" i]').first().attr("src");

  // Disponibilidad: Puntoticket la calcula en el navegador y no encontramos
  // una fuente estable. En las páginas "especiales" aparece el texto AGOTADO
  // bajo los botones de compra; si está y no hay ningún botón DISPONIBLE, lo
  // marcamos agotado. Si no, queda null (desconocido). Pendiente de mejorar.
  const textosBoton = $("small, .legal-btn, .btn")
    .map((_, el) => limpiar($(el).text())?.toUpperCase())
    .get();
  const agotado = textosBoton.includes("AGOTADO") && !textosBoton.includes("DISPONIBLE") ? true : null;

  const performer = Array.isArray(schema?.performer) ? schema?.performer[0] : schema?.performer;
  const loc = schema?.location;

  return {
    inicio: schema?.startDate ?? null,
    artista: limpiar(performer?.name),
    urlCanonica: sinParametros(schema?.url),
    recinto: {
      nombre: limpiar(loc?.name),
      direccion: limpiar(loc?.address?.streetAddress),
      comuna: limpiar(loc?.address?.addressLocality),
      latitud: typeof loc?.geo?.latitude === "number" ? loc.geo.latitude : null,
      longitud: typeof loc?.geo?.longitude === "number" ? loc.geo.longitude : null,
    },
    precioMin: schema?.offers?.lowPrice ?? null,
    precioMax: schema?.offers?.highPrice ?? null,
    moneda: schema?.offers?.PriceCurrency ?? schema?.offers?.priceCurrency ?? null,
    sectores,
    imagenPreciosUrl: sectores.length === 0 ? urlAbsoluta(imagenPrecios) : null,
    agotado,
  };
}
