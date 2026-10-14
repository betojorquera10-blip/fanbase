// Busca eventos guardados con los mismos filtros que la API, y muestra un
// resumen de las últimas corridas del scraper.
//
//   npm run eventos
//   npm run eventos -- --max 10000              → entradas de hasta $10.000 (precio base)
//   npm run eventos -- --max 10000 --total      → idem, pero comparando con precio + cargo
//   npm run eventos -- --finde --genero rock    → próximo fin de semana, solo rock
//   npm run eventos -- --texto cerati --agotados

import { prisma } from "../src/lib/db";
import { buscarEventos, proximoFinDeSemana } from "../src/lib/eventos";

const args = process.argv.slice(2);
const valor = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const pesos = (n: number | null) => (n == null ? "?" : `$${n.toLocaleString("es-CL")}`);

async function main() {
  const max = valor("--max");
  const resultado = await buscarEventos({
    ...(args.includes("--finde") ? proximoFinDeSemana() : {}),
    precioMax: max ? Number(max) : undefined,
    tipoPrecio: args.includes("--total") ? "total" : "base",
    genero: valor("--genero"),
    texto: valor("--texto"),
    incluirAgotados: args.includes("--agotados"),
    limite: 100,
  });

  const f = resultado.filtros;
  console.log(`\n${resultado.total} evento(s) — desde ${f.desde}${f.hasta ? ` hasta ${f.hasta}` : ""}` +
    `${f.precioMax ? `, entradas de hasta ${pesos(f.precioMax)} (precio ${f.tipoPrecio})` : ""}:\n`);

  for (const e of resultado.eventos) {
    console.log(`• ${e.fecha ?? "sin fecha"}${e.fechaFin ? ` → ${e.fechaFin}` : ""} ${e.hora ?? ""}  ${e.nombre}  [${e.genero ?? "?"}]${e.agotado ? "  (AGOTADO)" : ""}`);
    console.log(`    ${e.recinto?.nombre ?? "recinto ?"}${e.recinto?.comuna ? `, ${e.recinto.comuna}` : ""}` +
      `  |  base desde ${pesos(e.precios.baseDesde)}, total desde ${pesos(e.precios.totalDesde)}`);
    if (f.precioMax) {
      for (const s of e.sectores) console.log(`      - ${s.nombre}: ${pesos(s.precio)} + ${pesos(s.cargo)} = ${pesos(s.total)}`);
      if (e.preciosEnImagen) console.log(`      (sectores publicados como imagen: ${e.preciosEnImagen})`);
    }
  }

  const ejecuciones = await prisma.ejecucionScraper.findMany({ orderBy: { id: "desc" }, take: 5 });
  console.log("\nÚltimas corridas del scraper:");
  for (const x of ejecuciones) {
    console.log(`  #${x.id} ${x.iniciadaEn.toLocaleString("es-CL")} — ${x.estado} — listado: ${x.listadoDescargado ? `${x.eventosEnListado} (${x.eventosNuevos} nuevos)` : "no tocaba"}, detalles: ${x.detallesRevisados}, errores: ${x.errores}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
