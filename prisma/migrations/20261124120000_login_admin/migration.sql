-- CreateTable
CREATE TABLE "admin_usuarios" (
    "id" SERIAL NOT NULL,
    "usuario" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMP(3),
    "ultimo_ingreso_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sesiones" (
    "id" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_usuarios_usuario_key" ON "admin_usuarios"("usuario");

-- CreateIndex
CREATE INDEX "admin_sesiones_usuario_id_idx" ON "admin_sesiones"("usuario_id");

-- AddForeignKey
ALTER TABLE "admin_sesiones" ADD CONSTRAINT "admin_sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "admin_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guardan huellas de contraseñas: sin RLS-policies nadie las lee por la API de
-- Supabase; el sitio entra como dueño de las tablas y no se ve afectado.
ALTER TABLE "admin_usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_sesiones" ENABLE ROW LEVEL SECURITY;
