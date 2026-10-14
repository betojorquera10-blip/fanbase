// ============================================================================
// Sincronización Puntoticket → base de datos de FanBase.
//
// Dos niveles, cada uno con su propia frecuencia (configurable en la base):
//
//   1. LISTADO — una sola descarga de /musica. Crea los eventos nuevos,
//      actualiza los datos básicos y desactiva los que ya no aparecen.
//      Se hace si pasaron `Fuente.horasEntreListados` horas desde el último.
//
//   2. DETALLE — una descarga por evento (precios por sector, hora, recinto y
//      coordenadas). Solo para los eventos cuya `proximaRevisionDetalle` ya
//      llegó; al terminar, se agenda la siguiente según ReglaFrecuencia
//      (más seguido mientras más cerca está el evento).
//
// Así se puede correr este proceso cada hora (o cada 15 minutos) sin costo
// extra: si a nada le toca, no descarga nada.
// ============================================================================

import { prisma } from "@/lib/db";
import { hoyEnChile } from "@/lib/eventos";
import { descargarHtml, esperar, leerEstadisticas, reiniciarEstadisticas } from "@/scraper/http";
import { parsearDetalle, parsearListado, type EventoListado, type SectorPrecio } from "./parse";

const FUENTE_ID = "puntoticket";
const PAUSA_ENTRE_DETALLES_MS = 1500; // no bombardear el sitio
const HORA_MS = 60 * 60 * 1000;

export interface OpcionesSincronizacion {
  forzarListado?: boolean; // descarga el listado aunque no le toque
  forzarDetalles?: boolean; // revisa el detalle de todos los eventos activos
  limiteDetalles?: number; // máximo de páginas de detalle por corrida
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / (24 * HORA_MS));
}

async function horasHastaProximaRevision(fechaInicio: string | null): Promise<number> {
  const reglas = await prisma.reglaFrecuencia.findMany({ orderBy: { orden: "asc" } });
  if (reglas.length === 0) return 24; // sin reglas configuradas: una vez al día
  const dias = fechaInicio ? diasEntre(hoyEnChile(), fechaInicio) : Number.POSITIVE_INFINITY;
  const regla =
    reglas.find((r) => r.diasHastaEventoMax == null || dias <= r.diasHastaEventoMax) ?? reglas[reglas.length - 1];
  return regla.horasEntreRevisiones;
}

// Puntoticket a veces repite el nombre de un sector (ej. dos funciones con
// "GENERAL"). La base exige nombres únicos por evento, así que numeramos.
function nombresUnicos(sectores: SectorPrecio[]): SectorPrecio[] {
  const vistos = new Map<string, number>();
  return sectores.map((s) => {
    const n = (vistos.get(s.nombre) ?? 0) + 1;
    vistos.set(s.nombre, n);
    return n === 1 ? s : { ...s, nombre: `${s.nombre} (${n})` };
  });
}

function minimo(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x != null);
  return v.length ? Math.min(...v) : null;
}

function maximo(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x != null);
  return v.length ? Math.max(...v) : null;
}

// ── Nivel 1: listado ─────────────────────────────────────────────────────

async function sincronizarListado(urlListado: string) {
  const html = await descargarHtml(urlListado);
  const eventos = parsearListado(html);

  // 0 eventos casi siempre significa que el sitio cambió su HTML o nos
  // bloqueó, no que no haya conciertos. Cortamos sin tocar la base: si
  // siguiéramos, desactivaríamos todos los eventos por error.
  if (eventos.length === 0) {
    throw new Error("El listado devolvió 0 eventos — ¿cambió el HTML de Puntoticket o nos bloqueó?");
  }

  const ahora = new Date();
  let nuevos = 0;

  for (const e of eventos) {
    const existente = await prisma.evento.findUnique({
      where: { fuenteId_idExterno: { fuenteId: FUENTE_ID, idExterno: e.idExterno } },
      select: { id: true },
    });
    if (existente) {
      // Las fechas NO se pisan acá: el detalle trae fecha y hora más precisas.
      await prisma.evento.update({
        where: { id: existente.id },
        data: {
          nombre: e.nombre,
          url: e.url,
          imagenUrl: e.imagenUrl,
          generoOriginal: e.generoOriginal,
          activo: true,
          ultimaVezVistoEn: ahora,
        },
      });
    } else {
      await prisma.evento.create({ data: datosNuevoEvento(e, ahora) });
      nuevos++;
    }
  }

  // Desactivar los que ya no están en el listado (terminaron, se agotaron
  // y los sacaron, o se cancelaron). No se borran: quedan como historial.
  const { count: desactivados } = await prisma.evento.updateMany({
    where: { fuenteId: FUENTE_ID, activo: true, idExterno: { notIn: eventos.map((e) => e.idExterno) } },
    data: { activo: false },
  });

  await prisma.fuente.update({ where: { id: FUENTE_ID }, data: { ultimoListadoEn: ahora } });
  return { enListado: eventos.length, nuevos, desactivados };
}

function datosNuevoEvento(e: EventoListado, ahora: Date) {
  return {
    fuenteId: FUENTE_ID,
    idExterno: e.idExterno,
    nombre: e.nombre,
    url: e.url,
    imagenUrl: e.imagenUrl,
    generoOriginal: e.generoOriginal,
    fechaInicio: e.fechaInicio,
    fechaFin: e.fechaFin,
    primeraVezVistoEn: ahora,
    ultimaVezVistoEn: ahora,
    proximaRevisionDetalle: ahora, // nuevo: su detalle se revisa en esta misma corrida
  };
}

// ── Nivel 2: detalle de un evento ─────────────────────────────────────────

async function sincronizarDetalle(evento: { id: number; url: string; fechaInicio: string | null; fechaFin: string | null }) {
  const d = parsearDetalle(await descargarHtml(evento.url));

  let recintoId: number | undefined;
  if (d.recinto.nombre) {
    const comuna = d.recinto.comuna ?? "";
    const datosRecinto = { direccion: d.recinto.direccion, latitud: d.recinto.latitud, longitud: d.recinto.longitud };
    const recinto = await prisma.recinto.upsert({
      where: { nombre_comuna: { nombre: d.recinto.nombre, comuna } },
      update: datosRecinto,
      create: { nombre: d.recinto.nombre, comuna, ...datosRecinto },
    });
    recintoId = recinto.id;
  }

  // "2027-03-18T21:00:00" → fecha "2027-03-18", hora "21:00"
  const [fechaDetalle, horaDetalle] = d.inicio?.split("T") ?? [];
  const fechaInicio = fechaDetalle ?? evento.fechaInicio;
  const fechaFin = evento.fechaFin && fechaInicio && evento.fechaFin > fechaInicio ? evento.fechaFin : fechaInicio;

  const sectores = nombresUnicos(d.sectores);
  const horas = await horasHastaProximaRevision(fechaInicio);

  // Todo junto en una transacción: nunca queda un evento con los precios a medio actualizar.
  await prisma.$transaction([
    prisma.sector.deleteMany({ where: { eventoId: evento.id } }),
    prisma.sector.createMany({ data: sectores.map((s) => ({ ...s, eventoId: evento.id })) }),
    prisma.evento.update({
      where: { id: evento.id },
      data: {
        artista: d.artista,
        recintoId,
        fechaInicio,
        fechaFin,
        hora: horaDetalle?.slice(0, 5) ?? null,
        precioBaseMin: minimo(sectores.map((s) => s.precio)),
        precioTotalMin: minimo(sectores.map((s) => s.total)) ?? d.precioMin,
        precioTotalMax: maximo(sectores.map((s) => s.total)) ?? d.precioMax,
        moneda: d.moneda ?? "CLP",
        agotado: d.agotado,
        imagenPreciosUrl: d.imagenPreciosUrl,
        detalleActualizadoEn: new Date(),
        proximaRevisionDetalle: new Date(Date.now() + horas * HORA_MS),
        erroresDetalle: 0,
      },
    }),
  ]);

  return {
    sectores: sectores.length,
    preciosEnImagen: d.imagenPreciosUrl != null,
    conCoordenadas: d.recinto.latitud != null,
  };
}

// ── Orquestación ─────────────────────────────────────────────────────────

export async function sincronizarPuntoticket(opciones: OpcionesSincronizacion = {}) {
  const { forzarListado = false, forzarDetalles = false, limiteDetalles = 60 } = opciones;

  const fuente = await prisma.fuente.findUnique({ where: { id: FUENTE_ID } });
  if (!fuente) throw new Error(`No existe la fuente "${FUENTE_ID}" — corre primero: npm run db:seed`);
  if (!fuente.activa) {
    console.log(`[puntoticket] La fuente está desactivada; no se hace nada.`);
    return;
  }

  const ejecucion = await prisma.ejecucionScraper.create({ data: { fuenteId: FUENTE_ID } });
  reiniciarEstadisticas();
  const consumo = () => {
    const { solicitudes, bytes } = leerEstadisticas();
    return { solicitudesHttp: solicitudes, bytesDescargados: bytes };
  };
  let errores = 0;
  const mensajes: string[] = [];

  try {
    // Nivel 1
    const tocaListado =
      forzarListado ||
      !fuente.ultimoListadoEn ||
      Date.now() - fuente.ultimoListadoEn.getTime() >= fuente.horasEntreListados * HORA_MS;

    if (tocaListado) {
      console.log(`[puntoticket] Descargando listado ${fuente.urlListado} ...`);
      const r = await sincronizarListado(fuente.urlListado);
      console.log(`[puntoticket] Listado: ${r.enListado} eventos, ${r.nuevos} nuevos, ${r.desactivados} desactivados.`);
      await prisma.ejecucionScraper.update({
        where: { id: ejecucion.id },
        data: {
          listadoDescargado: true,
          eventosEnListado: r.enListado,
          eventosNuevos: r.nuevos,
          eventosDesactivados: r.desactivados,
        },
      });
    } else {
      console.log(`[puntoticket] Listado al día (último: ${fuente.ultimoListadoEn?.toLocaleString("es-CL")}).`);
    }

    // Los eventos que ya pasaron dejan de estar activos aunque sigan en el listado.
    await prisma.evento.updateMany({
      where: { fuenteId: FUENTE_ID, activo: true, fechaFin: { lt: hoyEnChile() } },
      data: { activo: false },
    });

    // Nivel 2
    const pendientes = await prisma.evento.findMany({
      where: {
        fuenteId: FUENTE_ID,
        activo: true,
        ...(forzarDetalles ? {} : { proximaRevisionDetalle: { lte: new Date() } }),
      },
      orderBy: { proximaRevisionDetalle: "asc" },
      take: limiteDetalles,
      select: { id: true, nombre: true, url: true, fechaInicio: true, fechaFin: true, erroresDetalle: true },
    });
    console.log(`[puntoticket] Detalles por revisar en esta corrida: ${pendientes.length}`);

    let revisados = 0;
    for (const [i, ev] of pendientes.entries()) {
      try {
        const r = await sincronizarDetalle(ev);
        revisados++;
        const notas = [r.preciosEnImagen && "precios en imagen", !r.conCoordenadas && "sin coordenadas"].filter(Boolean);
        console.log(`  (${i + 1}/${pendientes.length}) ✓ ${ev.nombre} — ${r.sectores} sectores${notas.length ? ` (${notas.join(", ")})` : ""}`);
      } catch (err) {
        errores++;
        const msg = err instanceof Error ? err.message : String(err);
        mensajes.push(`${ev.nombre}: ${msg}`);
        console.warn(`  (${i + 1}/${pendientes.length}) ✗ ${ev.nombre} — ${msg}`);
        // Reintento con espera creciente: 2h, 4h, 8h... hasta 24h.
        const espera = Math.min(2 ** (ev.erroresDetalle + 1), 24);
        await prisma.evento.update({
          where: { id: ev.id },
          data: { erroresDetalle: { increment: 1 }, proximaRevisionDetalle: new Date(Date.now() + espera * HORA_MS) },
        });
      }
      if (i < pendientes.length - 1) await esperar(PAUSA_ENTRE_DETALLES_MS);
    }

    await prisma.ejecucionScraper.update({
      where: { id: ejecucion.id },
      data: {
        terminadaEn: new Date(),
        estado: errores ? "con_errores" : "ok",
        detallesRevisados: revisados,
        errores,
        mensaje: mensajes.join("\n").slice(0, 4000) || null,
        ...consumo(),
      },
    });
    const c = consumo();
    console.log(`[puntoticket] Listo: ${revisados} detalles actualizados, ${errores} errores.`);
    console.log(`[puntoticket] Consumo: ${c.solicitudesHttp} solicitudes, ${(c.bytesDescargados / 1024 / 1024).toFixed(2)} MB descargados, 0 tokens de IA.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.ejecucionScraper.update({
      where: { id: ejecucion.id },
      data: { terminadaEn: new Date(), estado: "fallida", errores: errores + 1, mensaje: msg, ...consumo() },
    });
    throw err;
  }
}
