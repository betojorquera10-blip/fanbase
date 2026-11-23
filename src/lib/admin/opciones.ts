// Listas de opciones de los formularios del panel de administración.
// Archivo aparte para que el navegador lo pueda usar sin cargar la base.

import { CATEGORIA_MUSICA } from "@/lib/categorias";
import type { DatosEvento, DatosLocal } from "@/lib/admin/manuales";

// Los eventos cargados a mano se guardan con esta fuente.
export const FUENTE_MANUAL = { id: "fanbase", nombre: "FanBase" } as const;

// Las mismas categorías que usan las fuentes automáticas (sin deportes por ahora).
export const CATEGORIAS = [
  CATEGORIA_MUSICA, "Teatro", "Humor", "Danza", "Cine", "Circo", "Exposición", "Charlas",
  "Ferias y festivales", "Infantil", "Gastronomía", "Otros",
];

export const FORMAS_COMPRA = [
  { id: "link", nombre: "Compra en un sitio web (link)" },
  { id: "contacto", nombre: "Por teléfono, WhatsApp o correo" },
  { id: "puerta", nombre: "Venta en la puerta" },
  { id: "inscripcion", nombre: "Gratis con inscripción" },
] as const;
export type FormaCompra = (typeof FORMAS_COMPRA)[number]["id"];

export const TIPOS_LOCAL = [
  { id: "bar", nombre: "Bar" },
  { id: "restaurante", nombre: "Restaurante" },
  { id: "cafe", nombre: "Café" },
  { id: "comida", nombre: "Lugar de comida" },
] as const;
export type TipoLocal = (typeof TIPOS_LOCAL)[number]["id"];

export const nombreTipoLocal = (id: string) => TIPOS_LOCAL.find((t) => t.id === id)?.nombre ?? "Local";

export const NIVELES_PRECIO = ["$", "$$", "$$$"];

// Formularios en blanco.
export const EVENTO_VACIO: DatosEvento = {
  nombre: "",
  artista: "",
  categoria: CATEGORIA_MUSICA,
  genero: "",
  descripcion: "",
  funciones: [{ fecha: "", hora: "", fechaFin: "" }],
  lugar: { nombre: "", region: "Metropolitana", comuna: "", direccion: "" },
  imagenUrl: "",
  gratis: false,
  entradas: [{ nombre: "General", precio: "", agotado: false }],
  formaCompra: "link",
  enlace: "",
  contacto: "",
  visible: true,
};

export const LOCAL_VACIO: DatosLocal = {
  nombre: "",
  tipo: "bar",
  musicaEnVivo: true,
  genero: "",
  descripcion: "",
  region: "Metropolitana",
  comuna: "",
  direccion: "",
  imagenUrl: "",
  horario: "",
  telefono: "",
  instagram: "",
  sitioWeb: "",
  nivelPrecio: "$$",
  entradaLiberada: false,
  programacion: [],
  visible: true,
};
