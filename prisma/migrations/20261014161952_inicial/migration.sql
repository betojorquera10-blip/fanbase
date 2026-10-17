-- CreateEnum
CREATE TYPE "dia_semana" AS ENUM ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo');

-- CreateTable
CREATE TABLE "fuentes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "url_listado" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "horas_entre_listados" INTEGER NOT NULL DEFAULT 3,
    "dias_del_mes" TEXT,
    "ultimo_listado_en" TIMESTAMP(3),

    CONSTRAINT "fuentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglas_frecuencia" (
    "id" SERIAL NOT NULL,
    "orden" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "dias_hasta_evento_max" INTEGER,
    "horas_entre_revisiones" INTEGER NOT NULL,

    CONSTRAINT "reglas_frecuencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recintos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "comuna" TEXT NOT NULL DEFAULT '',
    "direccion" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recintos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" SERIAL NOT NULL,
    "fuente_id" TEXT NOT NULL,
    "id_externo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "artista" TEXT,
    "url" TEXT NOT NULL,
    "imagen_url" TEXT,
    "genero_original" TEXT,
    "categoria" TEXT NOT NULL DEFAULT 'Música',
    "descripcion" TEXT,
    "fecha_inicio" TEXT,
    "fecha_fin" TEXT,
    "hora" TEXT,
    "recinto_id" INTEGER,
    "precio_base_min" INTEGER,
    "precio_total_min" INTEGER,
    "precio_total_max" INTEGER,
    "moneda" TEXT,
    "agotado" BOOLEAN,
    "imagen_precios_url" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "primera_vez_visto_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_vez_visto_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalle_actualizado_en" TIMESTAMP(3),
    "proxima_revision_detalle" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errores_detalle" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sectores" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" INTEGER,
    "cargo" INTEGER,
    "total" INTEGER,

    CONSTRAINT "sectores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejecuciones_scraper" (
    "id" SERIAL NOT NULL,
    "fuente_id" TEXT NOT NULL,
    "iniciada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminada_en" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'en_curso',
    "listado_descargado" BOOLEAN NOT NULL DEFAULT false,
    "eventos_en_listado" INTEGER NOT NULL DEFAULT 0,
    "eventos_nuevos" INTEGER NOT NULL DEFAULT 0,
    "eventos_desactivados" INTEGER NOT NULL DEFAULT 0,
    "detalles_revisados" INTEGER NOT NULL DEFAULT 0,
    "errores" INTEGER NOT NULL DEFAULT 0,
    "solicitudes_http" INTEGER NOT NULL DEFAULT 0,
    "bytes_descargados" INTEGER NOT NULL DEFAULT 0,
    "tokens_ia" INTEGER NOT NULL DEFAULT 0,
    "mensaje" TEXT,

    CONSTRAINT "ejecuciones_scraper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bares" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "comuna" TEXT NOT NULL,
    "direccion" TEXT,
    "genero" TEXT NOT NULL,
    "nivel_precio" TEXT NOT NULL DEFAULT '$$',
    "entrada_liberada" BOOLEAN NOT NULL DEFAULT false,
    "descripcion" TEXT,
    "instagram" TEXT,
    "sitio_web" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "es_ejemplo" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bares_programacion" (
    "id" SERIAL NOT NULL,
    "bar_id" INTEGER NOT NULL,
    "dia" "dia_semana" NOT NULL,
    "evento" TEXT NOT NULL,
    "hora" TEXT NOT NULL,

    CONSTRAINT "bares_programacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reglas_frecuencia_orden_key" ON "reglas_frecuencia"("orden");

-- CreateIndex
CREATE UNIQUE INDEX "recintos_nombre_comuna_key" ON "recintos"("nombre", "comuna");

-- CreateIndex
CREATE INDEX "eventos_fecha_inicio_idx" ON "eventos"("fecha_inicio");

-- CreateIndex
CREATE INDEX "eventos_categoria_idx" ON "eventos"("categoria");

-- CreateIndex
CREATE INDEX "eventos_activo_proxima_revision_detalle_idx" ON "eventos"("activo", "proxima_revision_detalle");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_fuente_id_id_externo_key" ON "eventos"("fuente_id", "id_externo");

-- CreateIndex
CREATE INDEX "sectores_precio_idx" ON "sectores"("precio");

-- CreateIndex
CREATE INDEX "sectores_total_idx" ON "sectores"("total");

-- CreateIndex
CREATE UNIQUE INDEX "sectores_evento_id_nombre_key" ON "sectores"("evento_id", "nombre");

-- CreateIndex
CREATE INDEX "bares_programacion_bar_id_idx" ON "bares_programacion"("bar_id");

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_fuente_id_fkey" FOREIGN KEY ("fuente_id") REFERENCES "fuentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_recinto_id_fkey" FOREIGN KEY ("recinto_id") REFERENCES "recintos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sectores" ADD CONSTRAINT "sectores_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecuciones_scraper" ADD CONSTRAINT "ejecuciones_scraper_fuente_id_fkey" FOREIGN KEY ("fuente_id") REFERENCES "fuentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bares_programacion" ADD CONSTRAINT "bares_programacion_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "bares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
