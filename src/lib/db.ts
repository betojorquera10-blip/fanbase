// Conexión única a la base de datos, compartida por el sitio, la API y el scraper.
//
// La base es PostgreSQL en Supabase. Prisma 7 se conecta mediante un
// "adaptador" del motor de base de datos; acá, el de PostgreSQL (node-postgres).

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function crearCliente() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL en el archivo .env");
  // En la nube cada instancia del sitio abre sus propias conexiones y el plan
  // gratis de Supabase tiene un máximo: DB_POOL_MAX lo limita (10 por defecto).
  const max = Number(process.env.DB_POOL_MAX) || 10;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max }) });
}

// En desarrollo, Next.js recarga los módulos con cada cambio; guardar el
// cliente en globalThis evita abrir una conexión nueva en cada recarga.
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalParaPrisma.prisma ?? crearCliente();

if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = prisma;
