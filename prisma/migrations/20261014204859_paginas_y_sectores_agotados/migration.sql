-- AlterTable
ALTER TABLE "eventos" ADD COLUMN     "pagina_id" INTEGER;

-- AlterTable
ALTER TABLE "sectores" ADD COLUMN     "agotado" BOOLEAN;

-- CreateTable
CREATE TABLE "paginas_fuente" (
    "id" SERIAL NOT NULL,
    "fuente_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "categoria" TEXT,
    "modificada_en" TIMESTAMP(3),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "nota" TEXT,
    "revisada_en" TIMESTAMP(3),
    "proxima_revision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errores" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "paginas_fuente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paginas_fuente_fuente_id_activa_proxima_revision_idx" ON "paginas_fuente"("fuente_id", "activa", "proxima_revision");

-- CreateIndex
CREATE UNIQUE INDEX "paginas_fuente_fuente_id_url_key" ON "paginas_fuente"("fuente_id", "url");

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_pagina_id_fkey" FOREIGN KEY ("pagina_id") REFERENCES "paginas_fuente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paginas_fuente" ADD CONSTRAINT "paginas_fuente_fuente_id_fkey" FOREIGN KEY ("fuente_id") REFERENCES "fuentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
