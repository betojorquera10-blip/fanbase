// Reporte de consumo de los scrapers, para estimar el costo de mantener
// FanBase actualizado: por fuente y por día, cuánto tiempo de máquina usa,
// cuánto descarga y cuánto ocupa la base de datos.
//
//   npm run consumo                  → el último día con corridas
//   npm run consumo -- --dias 7      → promedio de los últimos 7 días con corridas

import { prisma } from "../src/lib/db";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const minutos = (ms: number) => `${(ms / 60_000).toFixed(1)} min`;

// Límites del plan gratis de Supabase, tal como los muestra su panel (Free plan usage).
const SUPABASE_FREE_DB_BYTES = 500 * 1024 * 1024;

// Fecha en Chile de una corrida, para agrupar por día.
const diaChile = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);

interface Totales {
  corridas: number;
  ms: number;
  solicitudes: number;
  bytes: number;
  paginas: number;
  nuevos: number;
  errores: number;
  tokens: number;
}

const vacio = (): Totales => ({ corridas: 0, ms: 0, solicitudes: 0, bytes: 0, paginas: 0, nuevos: 0, errores: 0, tokens: 0 });

async function main() {
  const args = process.argv.slice(2);
  const iDias = args.indexOf("--dias");
  const cantidadDias = iDias >= 0 ? Math.max(1, Number(args[iDias + 1]) || 1) : 1;

  const corridas = await prisma.ejecucionScraper.findMany({
    where: { terminadaEn: { not: null }, solicitudesHttp: { gt: 0 } },
    orderBy: { iniciadaEn: "desc" },
    take: 2000,
  });
  if (corridas.length === 0) {
    console.log("Todavía no hay corridas con consumo registrado.");
    return;
  }

  // Los últimos N días que tuvieron corridas.
  const dias = [...new Set(corridas.map((c) => diaChile(c.iniciadaEn)))].slice(0, cantidadDias);
  const elegidas = corridas.filter((c) => dias.includes(diaChile(c.iniciadaEn)));

  const porFuente = new Map<string, Totales>();
  const total = vacio();
  for (const c of elegidas) {
    const t = porFuente.get(c.fuenteId) ?? vacio();
    for (const destino of [t, total]) {
      destino.corridas++;
      destino.ms += c.terminadaEn!.getTime() - c.iniciadaEn.getTime();
      destino.solicitudes += c.solicitudesHttp;
      destino.bytes += c.bytesDescargados;
      destino.paginas += c.detallesRevisados + (c.listadoDescargado ? 1 : 0);
      destino.nuevos += c.eventosNuevos;
      destino.errores += c.errores;
      destino.tokens += c.tokensIA;
    }
    porFuente.set(c.fuenteId, t);
  }

  const n = dias.length;
  const titulo = n === 1 ? `Día ${dias[0]}` : `Promedio diario de ${n} días (${dias[n - 1]} a ${dias[0]})`;
  console.log(`\n${titulo}\n`);
  console.log("  fuente         corridas   tiempo   solicitudes   descargado   páginas   nuevos   errores");
  const fila = (nombre: string, t: Totales) =>
    console.log(
      `  ${nombre.padEnd(14)} ${String(Math.round(t.corridas / n)).padStart(8)} ${minutos(t.ms / n).padStart(8)}` +
        ` ${String(Math.round(t.solicitudes / n)).padStart(13)} ${mb(t.bytes / n).padStart(12)}` +
        ` ${String(Math.round(t.paginas / n)).padStart(9)} ${String(Math.round(t.nuevos / n)).padStart(8)} ${String(Math.round(t.errores / n)).padStart(9)}`,
    );
  for (const [fuente, t] of [...porFuente].sort((a, b) => b[1].ms - a[1].ms)) fila(fuente, t);
  fila("TOTAL", total);

  console.log(`\nProyección a 30 días:`);
  console.log(`  Tiempo de máquina: ${(((total.ms / n) * 30) / 3_600_000).toFixed(1)} horas`);
  console.log(`  Descargas:         ${mb((total.bytes / n) * 30)} (${Math.round((total.solicitudes / n) * 30)} solicitudes)`);
  console.log(`  Tokens de IA:      ${Math.round((total.tokens / n) * 30)} (las fuentes se leen sin IA: costo $0)`);

  // Tamaño de la base: es lo que limita el plan gratis de Supabase.
  const [{ bytes: tamano }] = await prisma.$queryRaw<{ bytes: bigint }[]>`select pg_database_size(current_database()) as bytes`;
  const tablas = await prisma.$queryRaw<{ tabla: string; filas: bigint; bytes: bigint }[]>`
    select relname as tabla, n_live_tup as filas, pg_total_relation_size(relid) as bytes
    from pg_stat_user_tables where schemaname = 'public' order by pg_total_relation_size(relid) desc limit 6`;
  console.log(`\nBase de datos (Supabase): ${mb(Number(tamano))} de ${mb(SUPABASE_FREE_DB_BYTES)} del plan gratis (${((Number(tamano) / SUPABASE_FREE_DB_BYTES) * 100).toFixed(0)}%)`);
  for (const t of tablas) console.log(`  ${t.tabla.padEnd(22)} ${String(t.filas).padStart(7)} filas  ${mb(Number(t.bytes)).padStart(9)}`);

  if (n < 7 && cantidadDias > 1) console.log("\n(Con menos de una semana de datos la proyección es aproximada.)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
