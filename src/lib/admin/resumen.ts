// Datos del panel de administración: el universo de eventos y locales, las
// fuentes con su frecuencia y el consumo de los scrapers.

import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { hoyEnChile } from "@/lib/fechas";
import { ubicarComuna } from "@/lib/regiones";
import { FUENTE_MANUAL, nombreTipoLocal } from "@/lib/admin/opciones";

const DIAS_CONSUMO = 30;
// Plan gratis de Supabase.
export const LIMITE_BASE_BYTES = 500 * 1024 * 1024;

// Cuenta cuántas veces aparece cada valor, de mayor a menor.
function contar(valores: string[]): { nombre: string; cantidad: number }[] {
  const m = new Map<string, number>();
  for (const v of valores) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
}

export async function resumenPanel() {
  // Se calcula en cada visita, con la fecha del momento.
  await connection();
  const hoy = hoyEnChile();
  const desdeConsumo = new Date(Date.now() - DIAS_CONSUMO * 86_400_000);

  const [eventos, fuentes, ultimas, consumo, locales, reglas, tamano, fotos] = await Promise.all([
    // Próximos eventos visibles (los que el sitio puede mostrar).
    prisma.evento.findMany({
      where: { activo: true, OR: [{ fechaFin: { gte: hoy } }, { fechaFin: null, fechaInicio: { gte: hoy } }] },
      select: { fuenteId: true, categoria: true, precioBaseMin: true, precioTotalMin: true, agotado: true, recinto: { select: { comuna: true } } },
    }),
    prisma.fuente.findMany({ where: { id: { not: FUENTE_MANUAL.id } }, orderBy: { nombre: "asc" } }),
    // Última corrida de cada fuente.
    prisma.ejecucionScraper.findMany({ distinct: ["fuenteId"], orderBy: [{ fuenteId: "asc" }, { iniciadaEn: "desc" }] }),
    prisma.ejecucionScraper.findMany({
      where: { iniciadaEn: { gte: desdeConsumo }, terminadaEn: { not: null } },
      select: { fuenteId: true, iniciadaEn: true, terminadaEn: true, solicitudesHttp: true, bytesDescargados: true, errores: true, tokensIA: true },
    }),
    prisma.bar.findMany({ select: { tipo: true, activo: true, musicaEnVivo: true, esEjemplo: true, comuna: true } }),
    prisma.reglaFrecuencia.findMany({ orderBy: { orden: "asc" } }),
    prisma.$queryRaw<{ bytes: bigint }[]>`select pg_database_size(current_database()) as bytes`,
    prisma.imagen.count(),
  ]);

  const gratis = eventos.filter((e) => (e.precioBaseMin ?? e.precioTotalMin) === 0).length;
  const porFuenteEventos = new Map(contar(eventos.map((e) => e.fuenteId)).map((x) => [x.nombre, x.cantidad]));

  // Consumo de los últimos 30 días por fuente.
  const diasConCorridas = new Set(consumo.map((c) => c.iniciadaEn.toISOString().slice(0, 10))).size;
  const consumoPorFuente = new Map<string, { corridas: number; minutos: number; solicitudes: number; mb: number; errores: number; tokens: number }>();
  for (const c of consumo) {
    const t = consumoPorFuente.get(c.fuenteId) ?? { corridas: 0, minutos: 0, solicitudes: 0, mb: 0, errores: 0, tokens: 0 };
    t.corridas++;
    t.minutos += (c.terminadaEn!.getTime() - c.iniciadaEn.getTime()) / 60_000;
    t.solicitudes += c.solicitudesHttp;
    t.mb += c.bytesDescargados / 1024 / 1024;
    t.errores += c.errores;
    t.tokens += c.tokensIA;
    consumoPorFuente.set(c.fuenteId, t);
  }
  const totalConsumo = [...consumoPorFuente.values()].reduce(
    (a, t) => ({ minutos: a.minutos + t.minutos, mb: a.mb + t.mb, solicitudes: a.solicitudes + t.solicitudes, tokens: a.tokens + t.tokens }),
    { minutos: 0, mb: 0, solicitudes: 0, tokens: 0 },
  );

  const ultimaPorFuente = new Map(ultimas.map((u) => [u.fuenteId, u]));
  const localesActivos = locales.filter((l) => l.activo);

  return {
    hoy,
    eventos: {
      total: eventos.length,
      gratis,
      agotados: eventos.filter((e) => e.agotado).length,
      manuales: porFuenteEventos.get(FUENTE_MANUAL.id) ?? 0,
      porCategoria: contar(eventos.map((e) => e.categoria)),
      porRegion: contar(eventos.map((e) => ubicarComuna(e.recinto?.comuna).region ?? "Sin región")),
    },
    locales: {
      total: localesActivos.length,
      ocultos: locales.length - localesActivos.length,
      ejemplos: localesActivos.filter((l) => l.esEjemplo).length,
      conMusica: localesActivos.filter((l) => l.musicaEnVivo).length,
      porTipo: contar(localesActivos.map((l) => nombreTipoLocal(l.tipo))),
    },
    fuentes: fuentes.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      url: f.urlListado,
      activa: f.activa,
      horasEntreListados: f.horasEntreListados,
      diasDelMes: f.diasDelMes,
      ultimoListadoEn: f.ultimoListadoEn?.toISOString() ?? null,
      eventos: porFuenteEventos.get(f.id) ?? 0,
      ultimaCorrida: (() => {
        const u = ultimaPorFuente.get(f.id);
        return u && { en: u.iniciadaEn.toISOString(), estado: u.estado, nuevos: u.eventosNuevos, errores: u.errores, mensaje: u.mensaje };
      })(),
      consumo: consumoPorFuente.get(f.id) ?? null,
    })),
    reglas: reglas.map((r) => ({ descripcion: r.descripcion, horas: r.horasEntreRevisiones })),
    consumo: { dias: diasConCorridas, ...totalConsumo },
    base: { bytes: Number(tamano[0]?.bytes ?? 0), limite: LIMITE_BASE_BYTES, fotos },
  };
}

export type ResumenPanel = Awaited<ReturnType<typeof resumenPanel>>;
