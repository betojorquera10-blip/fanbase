// Conexión única a la base de datos, compartida por el sitio, la API y el scraper.
//
// Prisma 7 se conecta mediante un "adaptador" del motor de base de datos. Hoy
// es SQLite (better-sqlite3); para pasar a PostgreSQL se cambia el adaptador
// acá y el `provider` en prisma/schema.prisma — el resto del código no cambia.

import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

function crearCliente() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL en el archivo .env");
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

// En desarrollo, Next.js recarga los módulos con cada cambio; guardar el
// cliente en globalThis evita abrir una conexión nueva en cada recarga.
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalParaPrisma.prisma ?? crearCliente();

if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = prisma;
