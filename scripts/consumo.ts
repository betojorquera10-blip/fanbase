// Reporte de consumo del scraper: cuánto descarga, cuánto tarda y cuántos
// tokens de IA usa cada corrida, con una proyección mensual.
//
//   npm run consumo

import { prisma } from "../src/lib/db";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

async function main() {
  const corridas = await prisma.ejecucionScraper.findMany({
    where: { terminadaEn: { not: null } },
    orderBy: { id: "desc" },
    take: 30,
  });
  if (corridas.length === 0) {
    console.log("Todavía no hay corridas terminadas.");
    return;
  }

  console.log("\nÚltimas corridas:\n");
  console.log("  #    fecha                  duración  solicitudes  descargado  tokens IA  estado");
  for (const c of corridas) {
    const seg = Math.round((c.terminadaEn!.getTime() - c.iniciadaEn.getTime()) / 1000);
    console.log(
      `  ${String(c.id).padEnd(4)} ${c.iniciadaEn.toLocaleString("es-CL").padEnd(22)} ${`${seg}s`.padStart(8)}` +
        `  ${String(c.solicitudesHttp).padStart(11)}  ${mb(c.bytesDescargados).padStart(10)}  ${String(c.tokensIA).padStart(9)}  ${c.estado}`
    );
  }

  // Proyección con las corridas que ya registran consumo (las primeras son anteriores a esta medición).
  const medidas = corridas.filter((c) => c.solicitudesHttp > 0);
  if (medidas.length === 0) return;

  // Días distintos con corridas, para calcular el promedio diario real.
  const dias = new Set(medidas.map((c) => c.iniciadaEn.toISOString().slice(0, 10))).size;
  const total = (campo: "solicitudesHttp" | "bytesDescargados" | "tokensIA") =>
    medidas.reduce((suma, c) => suma + c[campo], 0);
  const porDia = (campo: "solicitudesHttp" | "bytesDescargados" | "tokensIA") => total(campo) / dias;

  console.log(`\nPromedio diario (${medidas.length} corridas en ${dias} día(s)):`);
  console.log(`  ${Math.round(porDia("solicitudesHttp"))} solicitudes, ${mb(porDia("bytesDescargados"))}, ${Math.round(porDia("tokensIA"))} tokens de IA`);
  console.log(`Proyección a 30 días:`);
  console.log(`  ${Math.round(porDia("solicitudesHttp") * 30)} solicitudes, ${mb(porDia("bytesDescargados") * 30)}, ${Math.round(porDia("tokensIA") * 30)} tokens de IA`);
  if (dias < 7) console.log("  (Con menos de una semana de datos la proyección es aproximada.)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
