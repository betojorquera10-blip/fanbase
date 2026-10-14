// Corre la sincronización de Puntoticket respetando las frecuencias
// configuradas en la base. Pensado para programarse cada hora.
//
//   npm run scrape                       → solo lo que toca según las reglas
//   npm run scrape -- --forzar           → listado + detalle de todos los eventos activos
//   npm run scrape -- --forzar-listado   → solo fuerza el listado
//   npm run scrape -- --limite 10        → máximo 10 páginas de detalle en esta corrida

import { prisma } from "../src/lib/db";
import { sincronizarPuntoticket } from "../src/scraper/puntoticket/sincronizar";

const args = process.argv.slice(2);
const forzar = args.includes("--forzar");
const iLimite = args.indexOf("--limite");
const limite = iLimite >= 0 ? Number(args[iLimite + 1]) : undefined;

sincronizarPuntoticket({
  forzarListado: forzar || args.includes("--forzar-listado"),
  forzarDetalles: forzar,
  limiteDetalles: Number.isFinite(limite) ? limite : undefined,
})
  .catch((err) => {
    console.error("[scrape] ERROR:", err instanceof Error ? err.message : err);
    process.exitCode = 1; // para que el programador de tareas registre la falla
  })
  .finally(() => prisma.$disconnect());
