// Corre la sincronización de todas las fuentes respetando las frecuencias
// configuradas en la base. Pensado para programarse una vez al día o cada hora.
//
//   npm run scrape                          → solo lo que toca según las reglas
//   npm run scrape -- --forzar              → todo: listados + detalle de todos los eventos activos
//   npm run scrape -- --forzar-listado      → solo fuerza los listados
//   npm run scrape -- --limite 10           → máximo 10 páginas de detalle por fuente
//   npm run scrape -- --fuente ticketplus   → solo una fuente (puntoticket | lascondes | ticketplus | ticketmaster | vitacura | lareina)

import { prisma } from "../src/lib/db";
import { sincronizarPuntoticket } from "../src/scraper/puntoticket/sincronizar";
import { sincronizarLasCondes } from "../src/scraper/lascondes/sincronizar";
import { sincronizarTicketplus } from "../src/scraper/ticketplus";
import { sincronizarTicketmaster } from "../src/scraper/ticketmaster";
import { sincronizarVitacura } from "../src/scraper/vitacura";
import { sincronizarLaReina } from "../src/scraper/lareina";

const args = process.argv.slice(2);
const valor = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const forzar = args.includes("--forzar");
const forzarListado = forzar || args.includes("--forzar-listado");
const limite = Number(valor("--limite"));
const soloFuente = valor("--fuente");

const FUENTES: Record<string, () => Promise<void>> = {
  puntoticket: () =>
    sincronizarPuntoticket({
      forzarListado,
      forzarDetalles: forzar,
      limiteDetalles: Number.isFinite(limite) ? limite : undefined,
    }),
  lascondes: () => sincronizarLasCondes({ forzar: forzarListado }),
  ticketplus: () => sincronizarTicketplus({ forzarListado, forzarDetalles: forzar, limite: Number.isFinite(limite) ? limite : undefined }),
  ticketmaster: () => sincronizarTicketmaster({ forzarListado, forzarDetalles: forzar, limite: Number.isFinite(limite) ? limite : undefined }),
  vitacura: () => sincronizarVitacura({ forzarListado, forzarDetalles: forzar, limite: Number.isFinite(limite) ? limite : undefined }),
  lareina: () => sincronizarLaReina({ forzarListado, forzarDetalles: forzar, limite: Number.isFinite(limite) ? limite : undefined }),
};

async function main() {
  if (soloFuente && !FUENTES[soloFuente]) {
    throw new Error(`Fuente desconocida "${soloFuente}". Opciones: ${Object.keys(FUENTES).join(", ")}`);
  }
  for (const [id, sincronizar] of Object.entries(FUENTES)) {
    if (soloFuente && id !== soloFuente) continue;
    // Una fuente que falla no detiene a las demás.
    try {
      await sincronizar();
    } catch (err) {
      console.error(`[${id}] ERROR:`, err instanceof Error ? err.message : err);
      process.exitCode = 1; // para que el programador de tareas registre la falla
    }
  }
}

main()
  .catch((err) => {
    console.error("[scrape] ERROR:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
