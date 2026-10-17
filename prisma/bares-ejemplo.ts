// Bares de EJEMPLO, copiados de la maqueta diseno/fanbase_0_1.html.
//
// Los horarios y shows son inventados. Se cargan con es_ejemplo = true y el
// sitio los marca como "Datos de ejemplo". Cuando el equipo ingrese bares
// reales en Supabase, estos se borran desde el Table Editor.

import type { DiaSemana } from "../src/lib/dias";

export const BARES_EJEMPLO: {
  nombre: string;
  comuna: string;
  genero: string;
  nivelPrecio: string;
  entradaLiberada: boolean;
  descripcion: string;
  programacion: { dia: DiaSemana; evento: string; hora: string }[];
}[] = [
  {
    nombre: "Bar de René",
    comuna: "Providencia",
    genero: "Rock",
    nivelPrecio: "$$",
    entradaLiberada: false,
    descripcion: "Bar de rock con programación frecuente y ambiente clásico.",
    programacion: [
      { dia: "jueves", evento: "Tributo 90s", hora: "22:00" },
      { dia: "viernes", evento: "Rock chileno", hora: "22:30" },
      { dia: "sabado", evento: "Metal Night", hora: "23:00" },
    ],
  },
  {
    nombre: "La Batuta",
    comuna: "Ñuñoa",
    genero: "Rock",
    nivelPrecio: "$$",
    entradaLiberada: false,
    descripcion: "Uno de los clásicos de la música en vivo de Santiago.",
    programacion: [
      { dia: "miercoles", evento: "Banda en vivo", hora: "23:00" },
      { dia: "viernes", evento: "Especial grunge", hora: "23:30" },
      { dia: "sabado", evento: "Fiesta rock", hora: "00:00" },
    ],
  },
  {
    nombre: "Blue Pub",
    comuna: "Providencia",
    genero: "Blues",
    nivelPrecio: "$$",
    entradaLiberada: true,
    descripcion: "Blues, jazz y sesiones abiertas.",
    programacion: [
      { dia: "martes", evento: "Jam Session", hora: "21:30" },
      { dia: "jueves", evento: "Blues acústico", hora: "21:00" },
      { dia: "sabado", evento: "Blues eléctrico", hora: "22:30" },
    ],
  },
  {
    nombre: "El Clan",
    comuna: "Recoleta",
    genero: "Indie",
    nivelPrecio: "$$",
    entradaLiberada: false,
    descripcion: "Programación alternativa, indie y electrónica.",
    programacion: [
      { dia: "jueves", evento: "DJ + Live Set", hora: "23:30" },
      { dia: "viernes", evento: "Indie Night", hora: "23:30" },
    ],
  },
  {
    nombre: "Rock & Guitars",
    comuna: "Las Condes",
    genero: "Rock",
    nivelPrecio: "$$$",
    entradaLiberada: false,
    descripcion: "Bar temático con repertorio de rock clásico.",
    programacion: [
      { dia: "miercoles", evento: "Acoustic Rock", hora: "20:30" },
      { dia: "viernes", evento: "Classic Rock", hora: "22:00" },
    ],
  },
  {
    nombre: "Subterráneo Sessions",
    comuna: "Providencia",
    genero: "Alternativo",
    nivelPrecio: "$$",
    entradaLiberada: true,
    descripcion: "Shows pequeños, bandas emergentes y sesiones alternativas.",
    programacion: [
      { dia: "jueves", evento: "Live Session", hora: "22:30" },
      { dia: "sabado", evento: "Post Punk Night", hora: "23:00" },
    ],
  },
];
