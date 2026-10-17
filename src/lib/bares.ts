// Bares con música en vivo. Se ingresan a mano en Supabase (tablas bares y
// bares_programacion); acá se leen para el sitio.

import { prisma } from "@/lib/db";
import { DIAS_SEMANA } from "@/lib/dias";

export async function listarBares() {
  const bares = await prisma.bar.findMany({
    where: { activo: true },
    include: { programacion: true },
    orderBy: { nombre: "asc" },
  });
  return bares.map((b) => ({
    id: b.id,
    nombre: b.nombre,
    comuna: b.comuna,
    direccion: b.direccion,
    genero: b.genero,
    nivelPrecio: b.nivelPrecio,
    entradaLiberada: b.entradaLiberada,
    descripcion: b.descripcion,
    instagram: b.instagram,
    sitioWeb: b.sitioWeb,
    esEjemplo: b.esEjemplo,
    // De lunes a domingo, y dentro del día por hora.
    programacion: b.programacion
      .map((s) => ({ dia: s.dia, evento: s.evento, hora: s.hora }))
      .sort((x, y) => DIAS_SEMANA.indexOf(x.dia) - DIAS_SEMANA.indexOf(y.dia) || x.hora.localeCompare(y.hora)),
  }));
}

export type Bar = Awaited<ReturnType<typeof listarBares>>[number];
