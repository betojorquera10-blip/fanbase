// ============================================================================
// Motor común para fuentes que se leen PÁGINA POR PÁGINA (Ticketplus,
// Ticketmaster). Cada fuente solo aporta dos funciones:
//
//   listar(html o url)  → las páginas de eventos que existen hoy
//   leer(html, página)  → los eventos de UNA página (puede haber varias
//                         funciones) o el motivo para descartarla
//
// El motor se encarga del resto, igual para todas:
//   1. LISTADO (según fuentes.horas_entre_listados): registra las páginas
//      nuevas en paginas_fuente, marca para releer las que cambiaron y
//      desactiva las que desaparecieron.
//   2. DETALLE: descarga las páginas a las que les toca (proxima_revision),
//      con pausa entre una y otra, guarda sus eventos y agenda la próxima
//      revisión según reglas_frecuencia. Las descartadas (deportes, fechas
//      pasadas) no se vuelven a descargar salvo que la fuente diga que cambiaron.
//   3. Registra la corrida en ejecuciones_scraper.
// ============================================================================

import { prisma } from "@/lib/db";
import { hoyEnChile } from "@/lib/fechas";
import { descargarHtml, esperar, leerEstadisticas, reiniciarEstadisticas } from "@/scraper/http";
import { HORA_MS, horasHastaProximaRevision, tocaListado } from "@/scraper/frecuencia";

export interface PaginaListada {
  url: string;
  categoria?: string; // si el listado la da (sección "música", "teatro"...)
  modificadaEn?: Date; // si el listado lo informa (sitemap)
}

export interface SectorLeido {
  nombre: string;
  precio: number | null; // sin cargo por servicio
  cargo: number | null;
  total: number | null; // con cargo
  agotado: boolean | null;
}

export interface EventoLeido {
  idExterno: string;
  nombre: string;
  artista?: string | null;
  categoria: string;
  categoriaFuente?: string | null; // cómo lo clasifica la fuente, para revisar
  generoOriginal?: string | null;
  descripcion?: string | null;
  fechaInicio: string; // YYYY-MM-DD, hora de Chile
  fechaFin: string;
  hora: string | null; // HH:MM, hora de Chile
  recinto: { nombre: string; comuna: string; direccion?: string | null; latitud?: number | null; longitud?: number | null } | null;
  // Con sectores, los precios "desde/hasta" se calculan de ellos. Sin
  // sectores (la fuente solo da el rango), se usan estos.
  sectores: SectorLeido[];
  precioBaseMin?: number | null;
  precioTotalMin?: number | null;
  precioTotalMax?: number | null;
  agotado: boolean | null;
  url: string;
  imagenUrl?: string | null;
}

export type ResultadoPagina = { eventos: EventoLeido[] } | { omitir: string };

export interface FuentePorPaginas {
  id: string;
  listar: (urlListado: string) => Promise<PaginaListada[]>;
  leer: (html: string, pagina: { url: string; categoria: string | null }) => ResultadoPagina;
  pausaMs: number; // entre descargas de detalle
  limitePorCorrida: number; // páginas de detalle por corrida
  timeoutMs?: number;
}

export interface OpcionesPorPaginas {
  forzarListado?: boolean;
  forzarDetalles?: boolean; // relee todas las páginas activas
  limite?: number;
}

const NUNCA = new Date("9999-12-31");
const DIA_MS = 24 * HORA_MS;

// Páginas descartadas (ej. deportes): se vuelven a mirar una vez al mes, por si cambian.
const REVISAR_OMITIDA_MS = 30 * DIA_MS;

function minimo(valores: (number | null | undefined)[]): number | null {
  const v = valores.filter((x): x is number => x != null);
  return v.length ? Math.min(...v) : null;
}
function maximo(valores: (number | null | undefined)[]): number | null {
  const v = valores.filter((x): x is number => x != null);
  return v.length ? Math.max(...v) : null;
}

// La base exige nombres de sector únicos por evento.
function nombresUnicos(sectores: SectorLeido[]): SectorLeido[] {
  const vistos = new Map<string, number>();
  return sectores.map((s) => {
    const n = (vistos.get(s.nombre) ?? 0) + 1;
    vistos.set(s.nombre, n);
    return n === 1 ? s : { ...s, nombre: `${s.nombre} (${n})` };
  });
}

async function guardarRecinto(r: NonNullable<EventoLeido["recinto"]>): Promise<number> {
  const datos = { direccion: r.direccion ?? null, latitud: r.latitud ?? null, longitud: r.longitud ?? null };
  const recinto = await prisma.recinto.upsert({
    where: { nombre_comuna: { nombre: r.nombre, comuna: r.comuna } },
    // No se borran datos que ya teníamos si esta fuente no los trae.
    update: Object.fromEntries(Object.entries(datos).filter(([, v]) => v != null)),
    create: { nombre: r.nombre, comuna: r.comuna, ...datos },
  });
  return recinto.id;
}

async function guardarEvento(fuenteId: string, paginaId: number, e: EventoLeido, ahora: Date): Promise<boolean> {
  const sectores = nombresUnicos(e.sectores);
  // "Desde" se calcula con lo que queda disponible; si todo está agotado, con todo.
  const paraPrecio = sectores.some((s) => s.agotado !== true) ? sectores.filter((s) => s.agotado !== true) : sectores;
  const datos = {
    nombre: e.nombre,
    artista: e.artista ?? null,
    url: e.url,
    imagenUrl: e.imagenUrl ?? null,
    generoOriginal: e.generoOriginal ?? null,
    categoria: e.categoria,
    categoriaFuente: e.categoriaFuente ?? null,
    descripcion: e.descripcion ?? null,
    fechaInicio: e.fechaInicio,
    fechaFin: e.fechaFin,
    hora: e.hora,
    recintoId: e.recinto ? await guardarRecinto(e.recinto) : null,
    paginaId,
    precioBaseMin: sectores.length ? minimo(paraPrecio.map((s) => s.precio)) : (e.precioBaseMin ?? null),
    precioTotalMin: sectores.length ? minimo(paraPrecio.map((s) => s.total)) : (e.precioTotalMin ?? null),
    precioTotalMax: sectores.length ? maximo(sectores.map((s) => s.total)) : (e.precioTotalMax ?? null),
    moneda: "CLP",
    agotado: e.agotado,
    activo: true,
    ultimaVezVistoEn: ahora,
    detalleActualizadoEn: ahora,
    // La revisión se agenda por página (paginas_fuente), no por evento.
    proximaRevisionDetalle: NUNCA,
    erroresDetalle: 0,
  };

  const existente = await prisma.evento.findUnique({
    where: { fuenteId_idExterno: { fuenteId, idExterno: e.idExterno } },
    select: { id: true },
  });
  const evento = existente
    ? await prisma.evento.update({ where: { id: existente.id }, data: datos })
    : await prisma.evento.create({ data: { ...datos, fuenteId, idExterno: e.idExterno, primeraVezVistoEn: ahora } });

  await prisma.$transaction([
    prisma.sector.deleteMany({ where: { eventoId: evento.id } }),
    prisma.sector.createMany({ data: sectores.map((s) => ({ ...s, eventoId: evento.id })) }),
  ]);
  return !existente;
}

// ── Nivel 1: listado ─────────────────────────────────────────────────────

async function sincronizarListado(fuente: FuentePorPaginas, urlListado: string) {
  const paginas = await fuente.listar(urlListado);
  // 0 páginas casi siempre significa que el sitio cambió o nos bloqueó: no se toca la base.
  if (paginas.length === 0) throw new Error("El listado devolvió 0 páginas — ¿cambió el sitio o nos bloqueó?");

  const existentes = new Map(
    (await prisma.paginaFuente.findMany({ where: { fuenteId: fuente.id } })).map((p) => [p.url, p]),
  );
  const ahora = new Date();
  let nuevas = 0;
  let cambiadas = 0;

  for (const p of paginas) {
    const previa = existentes.get(p.url);
    if (!previa) {
      await prisma.paginaFuente.create({
        data: {
          fuenteId: fuente.id,
          url: p.url,
          categoria: p.categoria ?? null,
          modificadaEn: p.modificadaEn ?? null,
          proximaRevision: ahora,
        },
      });
      nuevas++;
      continue;
    }
    // Cambió según la fuente (o volvió a aparecer): se relee en esta corrida.
    const cambio = p.modificadaEn && (!previa.revisadaEn || p.modificadaEn > previa.revisadaEn);
    if (cambio || !previa.activa) cambiadas++;
    await prisma.paginaFuente.update({
      where: { id: previa.id },
      data: {
        activa: true,
        categoria: p.categoria ?? previa.categoria,
        modificadaEn: p.modificadaEn ?? previa.modificadaEn,
        ...(cambio || !previa.activa ? { proximaRevision: ahora } : {}),
      },
    });
  }

  // Las que ya no están en el listado: se desactivan con sus eventos (quedan como historial).
  const urls = new Set(paginas.map((p) => p.url));
  const desaparecidas = [...existentes.values()].filter((p) => p.activa && !urls.has(p.url)).map((p) => p.id);
  if (desaparecidas.length) {
    await prisma.paginaFuente.updateMany({ where: { id: { in: desaparecidas } }, data: { activa: false } });
    await prisma.evento.updateMany({ where: { paginaId: { in: desaparecidas } }, data: { activo: false } });
  }

  await prisma.fuente.update({ where: { id: fuente.id }, data: { ultimoListadoEn: ahora } });
  return { enListado: paginas.length, nuevas, cambiadas, desactivadas: desaparecidas.length };
}

// ── Nivel 2: detalle de una página ────────────────────────────────────────

async function sincronizarPagina(fuente: FuentePorPaginas, pagina: { id: number; url: string; categoria: string | null }) {
  const html = await descargarHtml(pagina.url, { timeoutMs: fuente.timeoutMs });
  const resultado = fuente.leer(html, pagina);
  const ahora = new Date();
  const hoy = hoyEnChile();

  if ("omitir" in resultado) {
    await prisma.evento.updateMany({ where: { paginaId: pagina.id }, data: { activo: false } });
    await prisma.paginaFuente.update({
      where: { id: pagina.id },
      data: { estado: "omitida", nota: resultado.omitir, revisadaEn: ahora, errores: 0, proximaRevision: new Date(Date.now() + REVISAR_OMITIDA_MS) },
    });
    return { guardados: 0, nuevos: 0, nota: `omitida: ${resultado.omitir}` };
  }

  // Las funciones que ya pasaron no se guardan.
  const vigentes = resultado.eventos.filter((e) => e.fechaFin >= hoy);
  let nuevos = 0;
  for (const e of vigentes) if (await guardarEvento(fuente.id, pagina.id, e, ahora)) nuevos++;

  // Funciones que ya no están en la página (o ya pasaron): dejan de mostrarse.
  await prisma.evento.updateMany({
    where: { paginaId: pagina.id, activo: true, idExterno: { notIn: vigentes.map((e) => e.idExterno) } },
    data: { activo: false },
  });

  // Próxima revisión según la función más cercana; si no queda ninguna, no se vuelve a leer.
  const proxima = vigentes.map((e) => e.fechaInicio).sort()[0];
  const horas = proxima ? await horasHastaProximaRevision(proxima < hoy ? hoy : proxima) : null;
  await prisma.paginaFuente.update({
    where: { id: pagina.id },
    data: {
      estado: vigentes.length ? "ok" : "pasada",
      nota: null,
      revisadaEn: ahora,
      errores: 0,
      proximaRevision: horas != null ? new Date(Date.now() + horas * HORA_MS) : NUNCA,
    },
  });
  return { guardados: vigentes.length, nuevos, nota: vigentes.length ? "" : "sin funciones futuras" };
}

// ── Orquestación ─────────────────────────────────────────────────────────

export async function sincronizarPorPaginas(fuente: FuentePorPaginas, opciones: OpcionesPorPaginas = {}) {
  const config = await prisma.fuente.findUnique({ where: { id: fuente.id } });
  if (!config) throw new Error(`No existe la fuente "${fuente.id}" — corre primero: npm run db:seed`);
  if (!config.activa) {
    console.log(`[${fuente.id}] La fuente está desactivada; no se hace nada.`);
    return;
  }

  const ejecucion = await prisma.ejecucionScraper.create({ data: { fuenteId: fuente.id } });
  reiniciarEstadisticas();
  const consumo = () => {
    const { solicitudes, bytes } = leerEstadisticas();
    return { solicitudesHttp: solicitudes, bytesDescargados: bytes };
  };
  let errores = 0;
  const mensajes: string[] = [];

  try {
    const turno = tocaListado(config);
    if (opciones.forzarListado || turno.toca) {
      console.log(`[${fuente.id}] Descargando listado ${config.urlListado} ...`);
      const r = await sincronizarListado(fuente, config.urlListado);
      console.log(`[${fuente.id}] Listado: ${r.enListado} páginas, ${r.nuevas} nuevas, ${r.cambiadas} cambiadas, ${r.desactivadas} desaparecidas.`);
      await prisma.ejecucionScraper.update({
        where: { id: ejecucion.id },
        data: { listadoDescargado: true, eventosEnListado: r.enListado, eventosDesactivados: r.desactivadas },
      });
    } else {
      console.log(`[${fuente.id}] Listado: no toca, ${turno.motivo}.`);
    }

    // Las funciones que ya pasaron dejan de estar activas.
    await prisma.evento.updateMany({
      where: { fuenteId: fuente.id, activo: true, fechaFin: { lt: hoyEnChile() } },
      data: { activo: false },
    });

    const pendientes = await prisma.paginaFuente.findMany({
      where: {
        fuenteId: fuente.id,
        activa: true,
        ...(opciones.forzarDetalles ? {} : { proximaRevision: { lte: new Date() } }),
      },
      orderBy: { proximaRevision: "asc" },
      take: opciones.limite ?? fuente.limitePorCorrida,
      select: { id: true, url: true, categoria: true, errores: true },
    });
    console.log(`[${fuente.id}] Páginas por revisar en esta corrida: ${pendientes.length}`);

    let revisadas = 0;
    let nuevos = 0;
    for (const [i, p] of pendientes.entries()) {
      try {
        const r = await sincronizarPagina(fuente, p);
        revisadas++;
        nuevos += r.nuevos;
        console.log(`  (${i + 1}/${pendientes.length}) ✓ ${p.url.replace(/^https?:\/\/[^/]+/, "")} — ${r.guardados} evento(s)${r.nota ? ` (${r.nota})` : ""}`);
      } catch (err) {
        errores++;
        const msg = err instanceof Error ? err.message : String(err);
        mensajes.push(`${p.url}: ${msg}`);
        console.warn(`  (${i + 1}/${pendientes.length}) ✗ ${p.url} — ${msg}`);
        // Reintento con espera creciente: 2h, 4h, 8h... hasta 24h.
        const espera = Math.min(2 ** (p.errores + 1), 24);
        await prisma.paginaFuente.update({
          where: { id: p.id },
          data: { estado: "error", nota: msg.slice(0, 500), errores: { increment: 1 }, proximaRevision: new Date(Date.now() + espera * HORA_MS) },
        });
      }
      if (i < pendientes.length - 1) await esperar(fuente.pausaMs);
    }

    const c = consumo();
    await prisma.ejecucionScraper.update({
      where: { id: ejecucion.id },
      data: {
        terminadaEn: new Date(),
        estado: errores ? "con_errores" : "ok",
        detallesRevisados: revisadas,
        eventosNuevos: nuevos,
        errores,
        mensaje: mensajes.join("\n").slice(0, 4000) || null,
        ...c,
      },
    });
    console.log(`[${fuente.id}] Listo: ${revisadas} páginas revisadas, ${nuevos} eventos nuevos, ${errores} errores.`);
    console.log(`[${fuente.id}] Consumo: ${c.solicitudesHttp} solicitudes, ${(c.bytesDescargados / 1024 / 1024).toFixed(2)} MB descargados, 0 tokens de IA.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.ejecucionScraper.update({
      where: { id: ejecucion.id },
      data: { terminadaEn: new Date(), estado: "fallida", errores: errores + 1, mensaje: msg, ...consumo() },
    });
    throw err;
  }
}
