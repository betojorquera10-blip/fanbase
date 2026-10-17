// Clasificación por palabras clave, compartida por las fuentes cuya categoría
// propia no es confiable o viene vacía (hoy, Ticketplus). Ver el orden de
// prioridades en `clasificar`.

import { CATEGORIA_MUSICA } from "@/lib/categorias";
import { normalizar } from "@/lib/fechas";

const RE_NO_ES_EVENTO = /\bspa\b|piscina|pack de entrada|entrada por el dia|estacionamiento|postulacion|\bliga\b|abono|\bsocios?\b|membres|\bplan futbol|zapping/;
const RE_HUMOR = /stand ?up|humor|comedia|comediante|humorista|rutina comica/;
const RE_IMPRO = /\bimpro\b|improvisa/;
const RE_CINE = /\bcine\b|cineclub|pelicula|\bfilm\b|documental|\bsala k\b/;
const RE_PLANETARIO = /planetario|\bdomo\b|fulldome/;
const RE_TEATRO = /obra de teatro|\bteatro\b|dramaturg|elenco|montaje|puesta en escena|\bobra\b/;
const RE_MUSICA =
  /concierto|tributo|\btour\b|en vivo|\bbanda\b|orquesta|recital|sinfoni|\bdj\b|\brock\b|jazz|cumbia|trap|reggaeton|tenor|folklor|cantante|\bmusica\b|\bdisco\b|album|techno|\bhouse\b|metal|punk|\bindie\b|\bpop\b|salsa|tango|bolero|\bcoro\b|piano|guitarra/;
const RE_FIESTA = /fiesta|discoteca|bailable|\bparty\b|\bafter\b|club subterraneo/;

export type Clasificacion = { categoria: string; genero: string | null } | { omitir: string };

// Categoría de FanBase (y género, si aplica). Muchos organizadores (sobre todo
// en Ticketplus) marcan su evento como "concierto" (MusicEvent) aunque sea teatro,
// impro o un show de planetario, así que el orden importa:
//   1. señales claras del nombre, 2. lo que la fuente declara (salvo música),
//   3. música en el nombre, 4. música declarada por la fuente, 5. la descripción.
//
// `categoriaFuente`: la categoría que da el sitio, tal cual ("Música",
// "Fiestas / Club", "Conciertos y Espectáculos-...-Teatro").
export function clasificar(tipos: string[], categoriaFuente: string, nombre: string, descripcion = ""): Clasificacion {
  // "Conciertos y Espectáculos" (Ticketplus) es genérico: no aporta.
  const cat = normalizar(categoriaFuente.replace(/conciertos y espect[aá]culos/gi, ""));
  const t = tipos.map((x) => x.toLowerCase());
  const n = normalizar(nombre);
  const d = normalizar(descripcion.slice(0, 800));
  const es = (categoria: string, genero: string | null = null) => ({ categoria, genero });

  if (t.includes("sportsevent") || /deporte|futbol|basquet|tenis|rugby|voleibol|hockey/.test(`${cat} ${n}`)) return { omitir: "deportes" };
  if (RE_NO_ES_EVENTO.test(n)) return { omitir: "no es un evento (pase, spa, postulación...)" };
  // Cursos y talleres de varias semanas no son eventos (ver Las Condes y Vitacura).
  if (/\bcursos?\b|\btalleres\b|inscripcion/.test(`${cat} ${n}`)) return { omitir: "curso, taller o inscripción" };
  if (/\bconcursos?\b|convocatoria/.test(`${cat} ${n}`)) return { omitir: "concurso o convocatoria" };

  // 1. Señales claras en el nombre.
  if (/\bcirco\b/.test(n)) return es("Circo");
  if (RE_IMPRO.test(n)) return es("Humor");
  if (RE_HUMOR.test(n)) return es("Humor");
  if (RE_CINE.test(n)) return es("Cine");
  if (RE_PLANETARIO.test(`${n} ${d}`) && !RE_MUSICA.test(n)) return es("Planetario");
  if (/danza|ballet/.test(n)) return es("Danza");
  // 2. Lo que declara la fuente, salvo música.
  if (/fiesta|discoteca|club subterraneo/.test(cat)) return es(CATEGORIA_MUSICA, "Fiesta");
  if (t.includes("theaterevent") || /teatro/.test(cat)) return es("Teatro");
  if (t.includes("comedyevent") || /humor|stand ?up|comedia/.test(cat)) return es("Humor");
  if (t.includes("danceevent") || /danza|ballet/.test(cat)) return es("Danza");
  if (t.includes("screeningevent") || /\bcine\b|pelicula/.test(cat)) return es("Cine");
  if (t.includes("childrensevent") || /infantil|ninos|familia/.test(cat)) return es("Infantil");
  if (t.includes("exhibitionevent") || /exposicion|museo/.test(cat)) return es("Exposición");
  if (t.includes("educationevent") || /charla|seminario|congreso|conferencia|educa/.test(cat)) return es("Charlas");
  if (/literatura|lectura|\blibros?\b|cuentacuento/.test(cat)) return es("Literatura");
  // 3. Música o teatro en el nombre.
  if (RE_FIESTA.test(n)) return es(CATEGORIA_MUSICA, "Fiesta");
  if (RE_MUSICA.test(n)) return es(CATEGORIA_MUSICA);
  if (RE_TEATRO.test(n)) return es("Teatro");
  // 4. Música declarada por la fuente.
  if (t.includes("musicevent") || /musica/.test(cat)) return es(CATEGORIA_MUSICA);
  // 5. La descripción: teatro antes que música, porque una obra suele mencionar su música.
  if (RE_HUMOR.test(d) || RE_IMPRO.test(d)) return es("Humor");
  if (RE_CINE.test(d)) return es("Cine");
  if (RE_TEATRO.test(d)) return es("Teatro");
  if (RE_MUSICA.test(d)) return es(CATEGORIA_MUSICA);
  if (t.includes("festival") || /feria|festival|expo/.test(`${cat} ${n}`)) return es("Ferias y festivales");
  if (/gastronom|degust|cata de|maridaje|\bvinos?\b|destilad|cervecer/.test(`${cat} ${n}`)) return es("Gastronomía");
  if (/charla|seminario|congreso|conversatorio|taller/.test(`${n} ${d}`)) return es("Charlas");
  return es("Otros");
}
