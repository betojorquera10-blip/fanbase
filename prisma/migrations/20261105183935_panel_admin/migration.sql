-- AlterTable
ALTER TABLE "bares" ADD COLUMN     "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "horario" TEXT,
ADD COLUMN     "imagen_url" TEXT,
ADD COLUMN     "musica_en_vivo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "telefono" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'bar';

-- CreateTable
CREATE TABLE "eventos_manuales" (
    "evento_id" INTEGER NOT NULL,
    "forma_compra" TEXT NOT NULL,
    "contacto" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_manuales_pkey" PRIMARY KEY ("evento_id")
);

-- CreateTable
CREATE TABLE "imagenes" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "datos" BYTEA NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imagenes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "eventos_manuales" ADD CONSTRAINT "eventos_manuales_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
