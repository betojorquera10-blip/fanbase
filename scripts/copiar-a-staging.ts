// Copia los datos de PRODUCCIÓN a STAGING, para que staging muestre los mismos
// eventos que el sitio real sin volver a scrapear. Una sola vía: staging se
// reemplaza completo; producción solo se lee.
//
//   npm run copiar-a-staging
//
// Usa PRODUCCION_DATABASE_URL (origen) y STAGING_DATABASE_URL (destino). La
// tarea programada lo corre después de los scrapers.

import "dotenv/config";
import { Client } from "pg";

// En orden: primero las tablas de las que otras dependen. Las corridas del
// scraper se copian para que el panel de administración de staging muestre
// las de producción (en staging no se scrapea).
const TABLAS = [
  "fuentes", "reglas_frecuencia", "recintos", "paginas_fuente", "eventos", "sectores",
  "bares", "bares_programacion", "eventos_manuales", "ejecuciones_scraper",
];
// Solo se vacían en staging: fotos subidas desde el panel para probar.
const SOLO_VACIAR = ["imagenes"];

const proyecto = (url: string) => url.match(/postgres\.([a-z0-9]+):/)?.[1] ?? url;

async function columnas(db: Client, tabla: string): Promise<string[]> {
  const r = await db.query("select column_name from information_schema.columns where table_schema = 'public' and table_name = $1", [tabla]);
  return r.rows.map((x) => x.column_name as string);
}

async function existe(db: Client, tabla: string): Promise<boolean> {
  const r = await db.query("select 1 from information_schema.tables where table_schema = 'public' and table_name = $1", [tabla]);
  return r.rowCount! > 0;
}

async function main() {
  const origenUrl = process.env.PRODUCCION_DATABASE_URL;
  const destinoUrl = process.env.STAGING_DATABASE_URL;
  if (!origenUrl || !destinoUrl) throw new Error("Faltan PRODUCCION_DATABASE_URL o STAGING_DATABASE_URL en el .env");
  // Nunca escribir sobre producción por un error de configuración.
  if (proyecto(origenUrl) === proyecto(destinoUrl)) throw new Error("Origen y destino son la misma base: no se copia nada.");

  const origen = new Client({ connectionString: origenUrl });
  const destino = new Client({ connectionString: destinoUrl });
  await origen.connect();
  await destino.connect();
  const inicio = Date.now();

  try {
    await destino.query("begin");
    // Se vacía staging entero (en una transacción: si algo falla, queda como estaba).
    // (Una tabla nueva que todavía no existe en alguna de las dos bases se salta.)
    const aVaciar: string[] = [];
    for (const t of [...TABLAS, ...SOLO_VACIAR]) if (await existe(destino, t)) aVaciar.push(t);
    await destino.query(`truncate ${aVaciar.map((t) => `"${t}"`).join(", ")} restart identity cascade`);

    for (const tabla of TABLAS) {
      if (!aVaciar.includes(tabla) || !(await existe(origen, tabla))) {
        console.log(`  ${tabla.padEnd(20)} (no existe en ambas bases, se salta)`);
        continue;
      }
      // Solo las columnas que existen en ambas bases (staging puede tener una
      // migración nueva que producción aún no tiene, o al revés).
      const enDestino = new Set(await columnas(destino, tabla));
      const cols = (await columnas(origen, tabla)).filter((c) => enDestino.has(c));
      const lista = cols.map((c) => `"${c}"`).join(", ");
      const { rows } = await origen.query(`select ${lista} from "${tabla}"`);

      // Inserción por lotes (PostgreSQL acepta hasta 65.535 parámetros por consulta).
      const porLote = Math.max(1, Math.floor(60_000 / cols.length));
      for (let i = 0; i < rows.length; i += porLote) {
        const lote = rows.slice(i, i + porLote);
        const valores: unknown[] = [];
        const filas = lote.map((fila) => `(${cols.map((c) => { valores.push(fila[c]); return `$${valores.length}`; }).join(", ")})`);
        await destino.query(`insert into "${tabla}" (${lista}) values ${filas.join(", ")}`, valores);
      }

      // Los contadores de id siguen desde el último copiado.
      // (Solo las tablas con id numérico; fuentes usa textos como "puntoticket").
      const secuencia = (await destino.query(`select pg_get_serial_sequence('"${tabla}"', 'id') as s`)).rows[0]?.s;
      if (secuencia) {
        await destino.query(`select setval($1, coalesce((select max(id) from "${tabla}"), 1), (select count(*) > 0 from "${tabla}"))`, [secuencia]);
      }
      console.log(`  ${tabla.padEnd(20)} ${String(rows.length).padStart(6)} filas`);
    }
    await destino.query("commit");
    console.log(`[copiar-a-staging] Listo en ${((Date.now() - inicio) / 1000).toFixed(1)} s (producción ${proyecto(origenUrl)} → staging ${proyecto(destinoUrl)}).`);
  } catch (err) {
    await destino.query("rollback");
    throw err;
  } finally {
    await origen.end();
    await destino.end();
  }
}

main().catch((err) => {
  console.error("[copiar-a-staging] ERROR:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
