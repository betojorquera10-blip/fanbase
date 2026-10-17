// ============================================================================
// Parser de la Agenda Cultural de Las Condes — HTML → datos, SIN IA.
//
// https://agendacultural.culturallascondes.cl/ publica TODA la agenda del mes
// en una sola página (WordPress). Cada actividad es un modal de Bootstrap:
//
//   <div class="modal" id="actvidad-7234">
//     <h2>CUERDAS MAGISTRALES</h2>
//     <h3>Ciclo de música de cámara UAI<br/>Nicolás Emilfork y ...</h3>
//     <div class="text-justify"> descripción </div>
//     <div class="info_footer">  una fila por ícono:
//        fa-calendar-alt → fecha  ("2, 16, 23 y 30 de octubre, 20:00 horas")
//        fa-map-marker-alt → lugar ("Teatro Centro Cultural")
//        fa-credit-card → precio  ("$ 8.000 general / $ 6.000 Tarjeta Vecino")
//
// La imagen está en el <a data-target="#actvidad-7234"> que abre el modal.
//
// Fechas, precios y categoría vienen escritos a mano, así que se leen con
// reglas. Lo que no calza con ninguna regla (ej. "Permanente", "Miércoles,
// 16:00 horas") se devuelve en `omitidas` con el motivo, para revisarlo.
// ============================================================================

import * as cheerio from "cheerio";
import { CATEGORIA_MUSICA } from "@/lib/categorias";
import { normalizar } from "@/lib/fechas";

export interface SectorAgenda {
  nombre: string;
  precio: number;
}

export interface EventoAgenda {
  idExterno: string; // "7234", o "7240-2026-10-16" si la actividad tiene varias fechas
  nombre: string;
  artista: string | null;
  categoria: string;
  generoOriginal: string | null;
  descripcion: string | null;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD
  hora: string | null; // HH:MM
  recinto: string | null;
  sectores: SectorAgenda[];
  precioBase: number | null; // 0 = entrada liberada
  agotado: boolean;
  url: string;
  imagenUrl: string | null;
}

export interface ActividadOmitida {
  titulo: string;
  motivo: string;
}

// ── Fechas ────────────────────────────────────────────────────────────────

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const MES = `(${Object.keys(MESES).join("|")})`;
const DIA_SEMANA = "(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)s?";
const HORA = /(\d{1,2}):(\d{2})/;

interface Ocurrencia {
  inicio: string;
  fin: string;
  hora: string | null;
  dia: number; // día del mes de inicio, para asociar artista y link de compra
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");
const iso = (anio: number, mes: number, dia: number) => `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`;

// Las fechas sin año se ubican en el año que las deja más cerca de hoy:
// leyendo el 1 de enero, "20 de diciembre" es del año pasado y "15 de enero" de este.
function conAnio(dia: number, mes: number, hoy: string, anio?: number): string {
  if (anio) return iso(anio, mes, dia);
  const actual = Number(hoy.slice(0, 4));
  const candidatos = [actual - 1, actual, actual + 1].map((a) => iso(a, mes, dia));
  const distancia = (f: string) => Math.abs(Date.parse(f) - Date.parse(hoy));
  return candidatos.reduce((a, b) => (distancia(b) < distancia(a) ? b : a));
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);
}

function primeraHora(texto: string): string | null {
  const m = texto.match(HORA);
  return m ? `${dosDigitos(Number(m[1]))}:${m[2]}` : null;
}

function rango(inicio: string, fin: string, texto: string): Ocurrencia {
  if (fin < inicio) fin = `${Number(fin.slice(0, 4)) + 1}${fin.slice(4)}`; // "20 de diciembre al 10 de enero"
  // En temporadas largas (exposiciones) la hora es la de apertura, no la de un show.
  const hora = diasEntre(inicio, fin) > 7 ? null : primeraHora(texto);
  return { inicio, fin, hora, dia: Number(inicio.slice(8)) };
}

// `texto` ya normalizado (minúsculas, sin tildes). `mesAgenda` se usa cuando
// la fecha no nombra el mes ("Sábado 3, 20:00 y domingo 4, 19:00 horas").
export function parsearFechas(texto: string, hoy: string, mesAgenda: number): Ocurrencia[] | string {
  if (/permanente|matricula/.test(texto)) return "actividad permanente o sin fechas concretas";

  // "Hasta el 31 de octubre"
  let m = texto.match(new RegExp(`hasta el (\\d{1,2}) de ${MES}(?: de (\\d{4}))?`));
  if (m) {
    const fin = conAnio(Number(m[1]), MESES[m[2]], hoy, Number(m[3]) || undefined);
    // Si ya terminó, queda como fecha pasada (no se guarda); si no, va desde hoy.
    return [fin < hoy ? { inicio: fin, fin, hora: null, dia: Number(fin.slice(8)) } : rango(hoy, fin, texto)];
  }

  // "9 de octubre a 29 de noviembre", "30 de septiembre de 2026 y el 28 de marzo de 2027",
  // "31 de octubre 1 de noviembre"
  m = texto.match(new RegExp(`(\\d{1,2}) de ${MES}(?: de (\\d{4}))?,? (?:a |al |y el |hasta el )?(\\d{1,2}) de ${MES}(?: de (\\d{4}))?`));
  if (m) {
    const inicio = conAnio(Number(m[1]), MESES[m[2]], hoy, Number(m[3]) || undefined);
    const fin = conAnio(Number(m[4]), MESES[m[5]], hoy, Number(m[6]) || undefined);
    return [rango(inicio, fin, texto)];
  }

  // "3 al 25 de octubre"
  m = texto.match(new RegExp(`(\\d{1,2}) (?:a|al) (\\d{1,2}) de ${MES}(?: de (\\d{4}))?`));
  if (m) {
    const mes = MESES[m[3]];
    const anio = Number(m[4]) || undefined;
    return [rango(conAnio(Number(m[1]), mes, hoy, anio), conAnio(Number(m[2]), mes, hoy, anio), texto)];
  }

  // "2, 16, 23 y 30 de octubre", "Lunes 5 y martes 13, 20 y 27 de octubre", "6 de octubre"
  const sinDiasSemana = texto.replace(new RegExp(`\\b${DIA_SEMANA}\\b\\s*`, "g"), "");
  m = sinDiasSemana.match(new RegExp(`(\\d{1,2}(?:\\s*(?:,|y)\\s*\\d{1,2})*) de ${MES}(?: de (\\d{4}))?`));
  if (m) {
    const mes = MESES[m[2]];
    const anio = Number(m[3]) || undefined;
    const fechas = m[1].split(/\s*(?:,|y)\s*/).map((d) => conAnio(Number(d), mes, hoy, anio));
    const hora = primeraHora(sinDiasSemana.slice((m.index ?? 0) + m[0].length));
    // Días seguidos (una feria de 3 días) son un solo evento; días sueltos, uno por fecha.
    const seguidos = fechas.length > 1 && fechas.every((f, i) => i === 0 || diasEntre(fechas[i - 1], f) === 1);
    if (seguidos) return [{ inicio: fechas[0], fin: fechas[fechas.length - 1], hora, dia: Number(fechas[0].slice(8)) }];
    return fechas.map((f) => ({ inicio: f, fin: f, hora, dia: Number(f.slice(8)) }));
  }

  // "Sábado 3, 20:00 y domingo 4, 19:00 horas", "Miércoles 7, 19:30 horas. Iglesia San Vicente Ferrer"
  // (sin mes: es el mes de la agenda). Cada fecha trae su propia hora.
  const sinMes = [...texto.matchAll(new RegExp(`\\b${DIA_SEMANA} (\\d{1,2})\\b,?\\s*(?:a las )?(\\d{1,2}:\\d{2})?`, "g"))];
  if (sinMes.length) {
    return sinMes.map((x) => {
      const fecha = conAnio(Number(x[1]), mesAgenda, hoy);
      return { inicio: fecha, fin: fecha, hora: x[2] ? primeraHora(x[2]) : null, dia: Number(x[1]) };
    });
  }

  return "sin fechas concretas (ej. se repite cada semana)";
}

// ── Precios ───────────────────────────────────────────────────────────────

const MONTO = /\$\s?(\d{1,3}(?:\.\d{3})*)/g;

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "$ 15.000 general / $ 13.000 Tarjeta Vecino Las Condes" → General 15000, Tarjeta Vecino Las Condes 13000
export function parsearPrecios(lineas: string[]): { sectores: SectorAgenda[]; precioBase: number | null } {
  const sectores: SectorAgenda[] = [];
  for (const linea of lineas) {
    const montos = [...linea.matchAll(MONTO)];
    montos.forEach((m, i) => {
      const desde = (m.index ?? 0) + m[0].length;
      const hasta = montos[i + 1]?.index ?? linea.length;
      const nombre = linea
        .slice(desde, hasta)
        .split(/[./(]/)[0]
        .replace(/^\s*(?:a|y|:|-|–)\s+/, "")
        .replace(/\s+(?:a|y)\s*$/, "")
        .trim();
      sectores.push({ nombre: capitalizar(nombre || "Entrada").slice(0, 80), precio: Number(m[1].replace(/\./g, "")) });
    });
  }

  // Nombres únicos (la base lo exige por evento).
  const vistos = new Map<string, number>();
  for (const s of sectores) {
    const n = (vistos.get(s.nombre) ?? 0) + 1;
    vistos.set(s.nombre, n);
    if (n > 1) s.nombre = `${s.nombre} (${n})`;
  }

  if (sectores.length) {
    // Lo que paga el público general; los descuentos (Tarjeta Vecino, niños) quedan como sectores.
    const general = sectores.find((s) => /general/i.test(s.nombre));
    return { sectores, precioBase: general?.precio ?? Math.min(...sectores.map((s) => s.precio)) };
  }
  const texto = normalizar(lineas.join(" "));
  return { sectores, precioBase: /liberad|gratis|gratuit/.test(texto) ? 0 : null };
}

// ── Categoría ─────────────────────────────────────────────────────────────

const RE_MUSICA = /concierto|orquesta|musica|musicos|\bcoro\b|\bbanda\b|jazz|sinfon|recital|\bopera\b|cantante/;

// Reglas en orden; la primera que calza gana. `null` = no es un evento (convocatorias, cursos).
export function clasificar(titulo: string, lugar: string, descripcion: string): string | null {
  const t = normalizar(titulo);
  const l = normalizar(lugar);
  const d = normalizar(descripcion.slice(0, 600));
  const enMuseo = /museo|salas? de exposicion/.test(l);

  if (/convocatoria|cursos y talleres/.test(t)) return null;
  // Una exposición SOBRE músicos (ej. Huasos Quincheros en la Casa Museo) no es un concierto.
  if (!enMuseo && RE_MUSICA.test(t)) return CATEGORIA_MUSICA;
  if (/feria|fiesta|festival|dia de muertos|anticuarios/.test(t)) return "Ferias y festivales";
  if (enMuseo || /exposicion|\bmuestra\b/.test(t)) return "Exposición";
  if (/conversatorio|charla|seminario|\bforo\b/.test(t)) return "Charlas";
  if (/\bcine\b|pelicula|documental/.test(t)) return "Cine";
  if (/biblioteca|lectura|\blibros?\b/.test(`${t} ${l}`)) return "Literatura";
  if (/teatro/.test(l) || /\bobra\b|montaje|elenco|dramaturg|teatr/.test(d)) return "Teatro";
  if (/concierto|orquesta/.test(d)) return CATEGORIA_MUSICA;
  return "Otros";
}

// ── Textos ────────────────────────────────────────────────────────────────

const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "en", "a", "al", "un", "una", "que", "con", "por", "para", "o"]);

// "ORQUESTA DE CÁMARA DE CHILE" → "Orquesta de Cámara de Chile". Solo cambia
// las palabras escritas en mayúsculas; el resto se respeta.
export function tituloLegible(titulo: string): string {
  return titulo
    .split(/\s+/)
    .map((p, i) => {
      if (p.length < 2 || p !== p.toUpperCase()) return p;
      const minuscula = p.toLowerCase();
      return i > 0 && MINUSCULAS.has(minuscula) ? minuscula : capitalizar(minuscula);
    })
    .join(" ")
    .replace(/\blas condes\b/gi, "Las Condes");
}

// Texto de un elemento respetando los saltos de línea de <br> y <p>.
function lineasDe($: cheerio.CheerioAPI, el: ReturnType<cheerio.CheerioAPI>): string[] {
  const html = (el.html() ?? "").replace(/<br\s*\/?>|<\/p>/gi, "\n");
  return cheerio
    .load(`<div>${html}</div>`)("div")
    .text()
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// ── Página completa ───────────────────────────────────────────────────────

export function parsearAgenda(html: string, urlAgenda: string, hoy: string): { eventos: EventoAgenda[]; omitidas: ActividadOmitida[] } {
  const $ = cheerio.load(html);
  const eventos: EventoAgenda[] = [];
  const omitidas: ActividadOmitida[] = [];

  const actividades = $('.modal[id^="actvidad-"]')
    .toArray()
    .map((modal) => {
      const $m = $(modal);
      const campo = (icono: string) => {
        const fila = $m.find(`.info_footer i.${icono}`).closest(".row");
        return fila.length ? lineasDe($, fila.find(".col-11").first()) : [];
      };
      const id = $m.attr("id")!.replace("actvidad-", "");
      return {
        id,
        titulo: $m.find("h2").first().text().replace(/\s+/g, " ").trim(),
        subtitulo: lineasDe($, $m.find("h3").first()),
        descripcion: $m.find(".text-justify p").toArray().map((p) => $(p).text().replace(/\s+/g, " ").trim()).filter(Boolean),
        fecha: campo("fa-calendar-alt"),
        lugar: campo("fa-map-marker-alt"),
        precio: campo("fa-credit-card"),
        links: $m.find(".info_footer i.fa-credit-card").closest(".row").find("a[href^='http']").toArray()
          .map((a) => ({ href: $(a).attr("href")!, texto: normalizar($(a).text()) })),
        imagenUrl: $(`a[data-target="#actvidad-${id}"] img`).attr("src") ?? null,
      };
    });

  // El mes de la agenda es el que más se nombra en las fechas.
  const conteo = new Map<number, number>();
  for (const a of actividades) {
    for (const [, mes] of normalizar(a.fecha.join(" ")).matchAll(new RegExp(MES, "g"))) {
      conteo.set(MESES[mes], (conteo.get(MESES[mes]) ?? 0) + 1);
    }
  }
  const mesAgenda = [...conteo].sort((a, b) => b[1] - a[1])[0]?.[0] ?? Number(hoy.slice(5, 7));

  for (const a of actividades) {
    if (!a.titulo) continue;
    const textoDescripcion = a.descripcion.join("\n\n");
    const categoria = clasificar(`${a.titulo} ${a.subtitulo.join(" ")}`, a.lugar.join(" "), textoDescripcion);
    if (!categoria) {
      omitidas.push({ titulo: a.titulo, motivo: "no es un evento (convocatoria o cursos)" });
      continue;
    }
    if (!a.fecha.length) {
      omitidas.push({ titulo: a.titulo, motivo: "sin fecha" });
      continue;
    }
    const ocurrencias = parsearFechas(normalizar(a.fecha.join(" / ")), hoy, mesAgenda);
    if (typeof ocurrencias === "string") {
      omitidas.push({ titulo: a.titulo, motivo: `${ocurrencias}: "${a.fecha.join(" / ")}"` });
      continue;
    }

    // Títulos de una palabra ("BIBLIOTECA") se completan con la actividad que nombra la descripción entre «».
    const destacada = !a.titulo.includes(" ") ? textoDescripcion.match(/«([^»]{3,80})»/)?.[1] : undefined;
    const nombre = destacada ? `${tituloLegible(a.titulo)}: ${destacada}` : tituloLegible(a.titulo);
    const { sectores, precioBase } = parsearPrecios(a.precio);
    const agotado = /agotad/.test(normalizar(a.precio.join(" ")));
    const descripcion = [a.subtitulo.join(" · "), textoDescripcion].filter(Boolean).join("\n\n").slice(0, 4000) || null;
    const generoOriginal = categoria === CATEGORIA_MUSICA && /camara|orquesta|sinfon|opera|\bcoro\b/.test(normalizar(`${a.titulo} ${a.subtitulo.join(" ")}`))
      ? "Clásica"
      : null;

    // Ciclos con un artista por fecha: "Leo Ramírez | 2 de octubre".
    const artistaPorDia = new Map<number, string>();
    for (const linea of a.descripcion) {
      const m = normalizar(linea).match(new RegExp(`\\|\\s*(\\d{1,2}) de ${MES}`));
      if (m) artistaPorDia.set(Number(m[1]), linea.split("|")[0].trim());
    }

    for (const o of ocurrencias) {
      const artista = ocurrencias.length > 1 ? (artistaPorDia.get(o.dia) ?? null) : null;
      // Link de compra: el que nombra este día ("Viernes 16 Ex Caldera"), o el primero.
      const link = a.links.find((l) => new RegExp(`\\b${o.dia}\\b`).test(l.texto)) ?? a.links[0];
      // Lugar: si hay uno por fecha ("Miércoles 7 Iglesia San Vicente Ferrer"), el de este día.
      const lugarDelDia = a.lugar.length > 1
        ? a.lugar.find((l) => new RegExp(`^(?:\\S+\\s+)?${o.dia}\\b`).test(l))?.replace(/^(?:\S+\s+)?\d{1,2}\s+/, "")
        : undefined;

      eventos.push({
        idExterno: ocurrencias.length > 1 ? `${a.id}-${o.inicio}` : a.id,
        nombre: artista ? `${nombre}: ${artista}` : nombre,
        artista,
        categoria,
        generoOriginal,
        descripcion,
        fechaInicio: o.inicio,
        fechaFin: o.fin,
        hora: o.hora,
        recinto: lugarDelDia ?? (a.lugar.join(", ") || null),
        sectores,
        precioBase,
        agotado,
        url: link?.href ?? `${urlAgenda}#actvidad-${a.id}`,
        imagenUrl: a.imagenUrl,
      });
    }
  }

  return { eventos, omitidas };
}
