// ============================================================================
// Sincronización Agenda Cultural de Las Condes → base de datos de FanBase.
//
// La agenda publica todo el mes en UNA página, así que cada corrida es una
// sola descarga (su robots.txt pide 10 s entre páginas; con una basta).
// No hay "detalle" como en Puntoticket: todo viene en el listado.
//
// Se lee solo los días configurados en Fuente.diasDelMes (por defecto 1, 2
// y 3 de cada mes, cuando sale la agenda nueva).
// ============================================================================

import { prisma } from "@/lib/db";
import { hoyEnChile } from "@/lib/fechas";
import { descargarHtml, leerEstadisticas, reiniciarEstadisticas } from "@/scraper/http";
import { tocaListado } from "@/scraper/frecuencia";
import { parsearAgenda, type EventoAgenda } from "./parse";

const FUENTE_ID = "lascondes";
const COMUNA = "Las Condes";
// El sitio a veces tarda más de un minuto en responder.
const TIMEOUT_MS = 120_000;

// Direcciones de los recintos de la Corporación Cultural (sección "GPS" de la agenda).
const DIRECCIONES: [RegExp, string][] = [
  [/museo inmersivo/i, "Isidora Goyenechea 3400"],
  [/los dominicos/i, "Av. Apoquindo 9085"],
  [/santa rosa de apoquindo/i, "Padre Hurtado Sur 1195"],
  [/centro cultural/i, "Av. Apoquindo 6570 (acceso por Nuestra Señora del Rosario 30)"],
];

export interface OpcionesLasCondes {
  forzar?: boolean; // descarga aunque no sea día 1, 2 o 3
}

async function guardarEvento(e: EventoAgenda, ahora: Date) {
  let recintoId: number | null = null;
  if (e.recinto) {
    const direccion = DIRECCIONES.find(([re]) => re.test(e.recinto!))?.[1] ?? null;
    const recinto = await prisma.recinto.upsert({
      where: { nombre_comuna: { nombre: e.recinto, comuna: COMUNA } },
      update: direccion ? { direccion } : {},
      create: { nombre: e.recinto, comuna: COMUNA, direccion },
    });
    recintoId = recinto.id;
  }

  const datos = {
    nombre: e.nombre,
    artista: e.artista,
    url: e.url,
    imagenUrl: e.imagenUrl,
    generoOriginal: e.generoOriginal,
    categoria: e.categoria,
    descripcion: e.descripcion,
    fechaInicio: e.fechaInicio,
    fechaFin: e.fechaFin,
    hora: e.hora,
    recintoId,
    // La agenda no informa cargo por servicio: precio base = total.
    precioBaseMin: e.precioBase,
    precioTotalMin: e.precioBase,
    precioTotalMax: e.sectores.length ? Math.max(...e.sectores.map((s) => s.precio)) : e.precioBase,
    moneda: "CLP",
    agotado: e.agotado,
    activo: true,
    ultimaVezVistoEn: ahora,
    detalleActualizadoEn: ahora,
    // Sin páginas de detalle que revisar: se actualiza con la próxima agenda.
    proximaRevisionDetalle: new Date("9999-12-31"),
  };

  const existente = await prisma.evento.findUnique({
    where: { fuenteId_idExterno: { fuenteId: FUENTE_ID, idExterno: e.idExterno } },
    select: { id: true },
  });
  const evento = existente
    ? await prisma.evento.update({ where: { id: existente.id }, data: datos })
    : await prisma.evento.create({ data: { ...datos, fuenteId: FUENTE_ID, idExterno: e.idExterno, primeraVezVistoEn: ahora } });

  await prisma.$transaction([
    prisma.sector.deleteMany({ where: { eventoId: evento.id } }),
    prisma.sector.createMany({
      data: e.sectores.map((s) => ({ eventoId: evento.id, nombre: s.nombre, precio: s.precio, cargo: null, total: s.precio })),
    }),
  ]);
  return !existente;
}

export async function sincronizarLasCondes(opciones: OpcionesLasCondes = {}) {
  const fuente = await prisma.fuente.findUnique({ where: { id: FUENTE_ID } });
  if (!fuente) throw new Error(`No existe la fuente "${FUENTE_ID}" — corre primero: npm run db:seed`);
  if (!fuente.activa) {
    console.log(`[lascondes] La fuente está desactivada; no se hace nada.`);
    return;
  }

  const hoy = hoyEnChile();
  const turno = tocaListado(fuente, hoy);
  if (!opciones.forzar && !turno.toca) {
    console.log(`[lascondes] No toca hoy: ${turno.motivo}.`);
    return;
  }

  const ejecucion = await prisma.ejecucionScraper.create({ data: { fuenteId: FUENTE_ID } });
  reiniciarEstadisticas();
  const consumo = () => {
    const { solicitudes, bytes } = leerEstadisticas();
    return { solicitudesHttp: solicitudes, bytesDescargados: bytes };
  };

  try {
    console.log(`[lascondes] Descargando agenda ${fuente.urlListado} ...`);
    const { eventos, omitidas } = parsearAgenda(await descargarHtml(fuente.urlListado, { timeoutMs: TIMEOUT_MS }), fuente.urlListado, hoy);

    // 0 eventos casi siempre significa que el sitio cambió su HTML, no que no haya agenda.
    // Cortamos sin tocar la base: si siguiéramos, desactivaríamos todo por error.
    if (eventos.length === 0) {
      throw new Error("La agenda devolvió 0 eventos — ¿cambió el HTML del sitio?");
    }

    // Lo que ya terminó no se guarda (la agenda del mes incluye fechas pasadas).
    const vigentes = eventos.filter((e) => e.fechaFin >= hoy);
    const ahora = new Date();
    let nuevos = 0;
    for (const e of vigentes) if (await guardarEvento(e, ahora)) nuevos++;

    // Lo que ya no aparece en la agenda (o ya pasó) deja de mostrarse. No se borra: queda como historial.
    const { count: desactivados } = await prisma.evento.updateMany({
      where: { fuenteId: FUENTE_ID, activo: true, idExterno: { notIn: vigentes.map((e) => e.idExterno) } },
      data: { activo: false },
    });

    await prisma.fuente.update({ where: { id: FUENTE_ID }, data: { ultimoListadoEn: ahora } });

    console.log(`[lascondes] Agenda: ${eventos.length} eventos leídos, ${vigentes.length} vigentes (${nuevos} nuevos), ${desactivados} desactivados.`);
    const porCategoria = new Map<string, number>();
    for (const e of vigentes) porCategoria.set(e.categoria, (porCategoria.get(e.categoria) ?? 0) + 1);
    console.log(`[lascondes] Por categoría: ${[...porCategoria].map(([c, n]) => `${c} ${n}`).join(", ")}.`);
    if (omitidas.length) {
      console.log(`[lascondes] ${omitidas.length} actividades sin fecha concreta (no se guardan):`);
      for (const o of omitidas) console.log(`    - ${o.titulo}: ${o.motivo}`);
    }

    const c = consumo();
    await prisma.ejecucionScraper.update({
      where: { id: ejecucion.id },
      data: {
        terminadaEn: new Date(),
        estado: "ok",
        listadoDescargado: true,
        eventosEnListado: vigentes.length,
        eventosNuevos: nuevos,
        eventosDesactivados: desactivados,
        mensaje: omitidas.length ? `Omitidas: ${omitidas.map((o) => o.titulo).join(", ")}`.slice(0, 4000) : null,
        ...c,
      },
    });
    console.log(`[lascondes] Consumo: ${c.solicitudesHttp} solicitud, ${(c.bytesDescargados / 1024 / 1024).toFixed(2)} MB descargados, 0 tokens de IA.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.ejecucionScraper.update({
      where: { id: ejecucion.id },
      data: { terminadaEn: new Date(), estado: "fallida", errores: 1, mensaje: msg, ...consumo() },
    });
    throw err;
  }
}
