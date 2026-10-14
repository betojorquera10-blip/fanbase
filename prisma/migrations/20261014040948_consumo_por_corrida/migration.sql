-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EjecucionScraper" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fuenteId" TEXT NOT NULL,
    "iniciadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadaEn" DATETIME,
    "estado" TEXT NOT NULL DEFAULT 'en_curso',
    "listadoDescargado" BOOLEAN NOT NULL DEFAULT false,
    "eventosEnListado" INTEGER NOT NULL DEFAULT 0,
    "eventosNuevos" INTEGER NOT NULL DEFAULT 0,
    "eventosDesactivados" INTEGER NOT NULL DEFAULT 0,
    "detallesRevisados" INTEGER NOT NULL DEFAULT 0,
    "errores" INTEGER NOT NULL DEFAULT 0,
    "solicitudesHttp" INTEGER NOT NULL DEFAULT 0,
    "bytesDescargados" INTEGER NOT NULL DEFAULT 0,
    "tokensIA" INTEGER NOT NULL DEFAULT 0,
    "mensaje" TEXT,
    CONSTRAINT "EjecucionScraper_fuenteId_fkey" FOREIGN KEY ("fuenteId") REFERENCES "Fuente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EjecucionScraper" ("detallesRevisados", "errores", "estado", "eventosDesactivados", "eventosEnListado", "eventosNuevos", "fuenteId", "id", "iniciadaEn", "listadoDescargado", "mensaje", "terminadaEn") SELECT "detallesRevisados", "errores", "estado", "eventosDesactivados", "eventosEnListado", "eventosNuevos", "fuenteId", "id", "iniciadaEn", "listadoDescargado", "mensaje", "terminadaEn" FROM "EjecucionScraper";
DROP TABLE "EjecucionScraper";
ALTER TABLE "new_EjecucionScraper" RENAME TO "EjecucionScraper";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
