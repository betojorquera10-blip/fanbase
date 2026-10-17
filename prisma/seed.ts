// Datos iniciales: las fuentes (Puntoticket, Ticketplus, Ticketmaster y las
// agendas culturales de Las Condes, Vitacura y La Reina), las reglas de
// frecuencia y los bares de ejemplo. Se puede correr varias veces sin duplicar nada:
//   - Las fuentes solo se crean si no existen.
//   - Las reglas de frecuencia se SOBREESCRIBEN con los valores de acá — si las
//     ajustaste en la base, cámbialas también en este archivo antes de correrlo.
//   - Los bares de ejemplo solo se cargan si la tabla bares está vacía (si ya
//     los borraron para poner bares reales, no vuelven).
//
//   npm run db:seed

import { prisma } from "../src/lib/db";
import { BARES_EJEMPLO } from "./bares-ejemplo";

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

  // Agenda mensual: se publica a comienzos de mes, se lee los días 1, 2 y 3.
  // 12 horas entre lecturas: así la tarea diaria lee una vez cada uno de esos días.
  await prisma.fuente.upsert({
    where: { id: "lascondes" },
    update: {},
    create: {
      id: "lascondes",
      nombre: "Agenda Cultural Las Condes",
      urlListado: "https://agendacultural.culturallascondes.cl/",
      horasEntreListados: 12,
      diasDelMes: "1,2,3",
    },
  });

  // Ticketplus y Ticketmaster: el listado (sitemap / secciones) cada 6 horas, para
  // que la tarea diaria siempre lo lea (cuesta 1 a 3 descargas);
  // el detalle de cada evento según reglas_frecuencia.
  await prisma.fuente.upsert({
    where: { id: "ticketplus" },
    update: {},
    create: { id: "ticketplus", nombre: "Ticketplus", urlListado: "https://ticketplus.cl/sitemap.xml", horasEntreListados: 6 },
  });
  await prisma.fuente.upsert({
    where: { id: "ticketmaster" },
    update: {},
    create: { id: "ticketmaster", nombre: "Ticketmaster", urlListado: "https://www.ticketmaster.cl/page/musica", horasEntreListados: 6 },
  });

  // Corporaciones culturales de Vitacura y La Reina: agendas municipales, casi
  // todo gratuito. El listado cada 6 horas (una o dos descargas).
  await prisma.fuente.upsert({
    where: { id: "vitacura" },
    update: {},
    create: { id: "vitacura", nombre: "Cultura Vitacura", urlListado: "https://vitacuracultura.cl/actividades/", horasEntreListados: 6 },
  });
  await prisma.fuente.upsert({
    where: { id: "lareina" },
    update: {},
    create: { id: "lareina", nombre: "Cultura La Reina", urlListado: "https://culturalareina.cl/evento-sitemap.xml", horasEntreListados: 6 },
  });

  for (const regla of REGLAS) {
    await prisma.reglaFrecuencia.upsert({ where: { orden: regla.orden }, update: regla, create: regla });
  }

  let baresCargados = 0;
  if ((await prisma.bar.count()) === 0) {
    for (const { programacion, ...bar } of BARES_EJEMPLO) {
      await prisma.bar.create({ data: { ...bar, esEjemplo: true, programacion: { create: programacion } } });
      baresCargados++;
    }
  }

  console.log(`Seed listo: 6 fuentes, ${REGLAS.length} reglas de frecuencia, ${baresCargados} bares de ejemplo cargados.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
