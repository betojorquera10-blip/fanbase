// Datos iniciales de configuración: la fuente Puntoticket y las reglas de
// frecuencia. Se puede correr varias veces sin duplicar nada (upsert). La
// fuente solo se crea si no existe; las reglas de frecuencia, en cambio, se
// SOBREESCRIBEN con los valores de acá — si las ajustaste en la base, cámbialas
// también en este archivo antes de volver a correrlo.
//
//   npm run db:seed

import { prisma } from "../src/lib/db";

const REGLAS = [
  { orden: 1, descripcion: "Falta menos de 7 días", diasHastaEventoMax: 7, horasEntreRevisiones: 6 },
  { orden: 2, descripcion: "Falta menos de 30 días", diasHastaEventoMax: 30, horasEntreRevisiones: 24 },
  { orden: 3, descripcion: "Falta más de 30 días", diasHastaEventoMax: null, horasEntreRevisiones: 168 },
];

async function main() {
  await prisma.fuente.upsert({
    where: { id: "puntoticket" },
    update: {},
    create: {
      id: "puntoticket",
      nombre: "Puntoticket",
      urlListado: "https://www.puntoticket.com/musica",
      horasEntreListados: 3,
    },
  });

  for (const regla of REGLAS) {
    await prisma.reglaFrecuencia.upsert({ where: { orden: regla.orden }, update: regla, create: regla });
  }

  console.log("Seed listo: fuente Puntoticket y", REGLAS.length, "reglas de frecuencia.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
