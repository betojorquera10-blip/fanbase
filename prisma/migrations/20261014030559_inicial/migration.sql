-- CreateTable
CREATE TABLE "Fuente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "urlListado" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "horasEntreListados" INTEGER NOT NULL DEFAULT 3,
    "ultimoListadoEn" DATETIME
);

-- CreateTable
CREATE TABLE "ReglaFrecuencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orden" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "diasHastaEventoMax" INTEGER,
    "horasEntreRevisiones" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Recinto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "comuna" TEXT NOT NULL DEFAULT '',
    "direccion" TEXT,
    "latitud" REAL,
    "longitud" REAL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fuenteId" TEXT NOT NULL,
    "idExterno" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "artista" TEXT,
    "url" TEXT NOT NULL,
    "imagenUrl" TEXT,
    "generoOriginal" TEXT,
    "fechaInicio" TEXT,
    "fechaFin" TEXT,
    "hora" TEXT,
    "recintoId" INTEGER,
    "precioBaseMin" INTEGER,
    "precioTotalMin" INTEGER,
    "precioTotalMax" INTEGER,
    "moneda" TEXT,
    "agotado" BOOLEAN,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "primeraVezVistoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaVezVistoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalleActualizadoEn" DATETIME,
    "proximaRevisionDetalle" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erroresDetalle" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Evento_fuenteId_fkey" FOREIGN KEY ("fuenteId") REFERENCES "Fuente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Evento_recintoId_fkey" FOREIGN KEY ("recintoId") REFERENCES "Recinto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" INTEGER NOT NULL,
    "cargo" INTEGER,
    "total" INTEGER,
    CONSTRAINT "Sector_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EjecucionScraper" (
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
    "mensaje" TEXT,
    CONSTRAINT "EjecucionScraper_fuenteId_fkey" FOREIGN KEY ("fuenteId") REFERENCES "Fuente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReglaFrecuencia_orden_key" ON "ReglaFrecuencia"("orden");

-- CreateIndex
CREATE UNIQUE INDEX "Recinto_nombre_comuna_key" ON "Recinto"("nombre", "comuna");

-- CreateIndex
CREATE INDEX "Evento_fechaInicio_idx" ON "Evento"("fechaInicio");

-- CreateIndex
CREATE INDEX "Evento_activo_proximaRevisionDetalle_idx" ON "Evento"("activo", "proximaRevisionDetalle");

-- CreateIndex
CREATE UNIQUE INDEX "Evento_fuenteId_idExterno_key" ON "Evento"("fuenteId", "idExterno");

-- CreateIndex
CREATE INDEX "Sector_precio_idx" ON "Sector"("precio");

-- CreateIndex
CREATE INDEX "Sector_total_idx" ON "Sector"("total");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_eventoId_nombre_key" ON "Sector"("eventoId", "nombre");
