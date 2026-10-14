-- AlterTable
ALTER TABLE "Evento" ADD COLUMN "imagenPreciosUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sector" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" INTEGER,
    "cargo" INTEGER,
    "total" INTEGER,
    CONSTRAINT "Sector_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Sector" ("cargo", "eventoId", "id", "nombre", "precio", "total") SELECT "cargo", "eventoId", "id", "nombre", "precio", "total" FROM "Sector";
DROP TABLE "Sector";
ALTER TABLE "new_Sector" RENAME TO "Sector";
CREATE INDEX "Sector_precio_idx" ON "Sector"("precio");
CREATE INDEX "Sector_total_idx" ON "Sector"("total");
CREATE UNIQUE INDEX "Sector_eventoId_nombre_key" ON "Sector"("eventoId", "nombre");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
