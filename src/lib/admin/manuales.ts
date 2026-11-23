// Eventos y locales cargados a mano desde el panel de administración.
//
// Un evento manual con varias funciones se guarda como varios eventos (uno por
// función), igual que las ticketeras, con idExterno "<grupo>/<n>". El "grupo"
// es lo que el panel edita como un solo evento.

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { hoyEnChile } from "@/lib/fechas";
import { REGIONES, ubicarComuna } from "@/lib/regiones";
import { DIAS_SEMANA, type DiaSemana } from "@/lib/dias";
import { CATEGORIA_MUSICA } from "@/lib/categorias";
import { CATEGORIAS, FORMAS_COMPRA, FUENTE_MANUAL, NIVELES_PRECIO, TIPOS_LOCAL, type FormaCompra, type TipoLocal } from "@/lib/admin/opciones";

// ── Lo que envían los formularios ───────────────────────────────────────

export interface DatosEvento {
  nombre: string;
  artista: string;
  categoria: string;
  genero: string;
  descripcion: string;
  funciones: { fecha: string; hora: string; fechaFin: string }[];
  lugar: { nombre: string; region: string; comuna: string; direccion: string };
  imagenUrl: string;
  gratis: boolean;
  entradas: { nombre: string; precio: string; agotado: boolean }[];
  formaCompra: FormaCompra;
  enlace: string;
  contacto: string;
  visible: boolean;
}

export interface DatosLocal {
  nombre: string;
  tipo: TipoLocal;
  musicaEnVivo: boolean;
  genero: string;
  descripcion: string;
  region: string;
  comuna: string;
  direccion: string;
  imagenUrl: string;
  horario: string;
  telefono: string;
  instagram: string;
  sitioWeb: string;
  nivelPrecio: string;
  entradaLiberada: boolean;
  programacion: { dia: DiaSemana; evento: string; hora: string }[];
  visible: boolean;
}

// Errores por campo, para mostrarlos junto al formulario.
export type Errores = string[];

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;
const limpio = (t: string | undefined | null) => (t ?? "").trim();
const oNulo = (t: string | undefined | null) => limpio(t) || null;
// "$15.000" o "15000" → 15000
const monto = (t: string) => {
  const n = Number(limpio(t).replace(/[^\d]/g, ""));
  return limpio(t) && Number.isFinite(n) ? n : null;
};
const esLink = (t: string) => /^https?:\/\/\S+\.\S+/.test(t);

function validarLugar(region: string, comuna: string, direccion: string, errores: Errores) {
  const r = REGIONES.find((x) => x.nombre === region);
  if (!r) errores.push("Elige la región.");
  else if (!r.comunas.includes(comuna)) errores.push("Elige la comuna.");
  if (!limpio(direccion)) errores.push("Escribe la dirección.");
}

// ── Eventos ─────────────────────────────────────────────────────────────

export function validarEvento(d: DatosEvento): Errores {
  const errores: Errores = [];
  if (!limpio(d.nombre)) errores.push("Escribe el nombre del evento.");
  if (!CATEGORIAS.includes(d.categoria)) errores.push("Elige la categoría.");
  if (d.funciones.length === 0) errores.push("Agrega al menos una fecha.");
  d.funciones.forEach((f, i) => {
    const n = d.funciones.length > 1 ? ` (función ${i + 1})` : "";
    if (!FECHA.test(f.fecha)) errores.push(`Elige la fecha${n}.`);
    if (f.hora && !HORA.test(f.hora)) errores.push(`La hora${n} debe ser como 21:00.`);
    if (f.fechaFin && (!FECHA.test(f.fechaFin) || f.fechaFin < f.fecha)) errores.push(`La fecha de término${n} debe ser posterior a la de inicio.`);
  });
  if (!limpio(d.lugar.nombre)) errores.push("Escribe el nombre del lugar.");
  validarLugar(d.lugar.region, d.lugar.comuna, d.lugar.direccion, errores);
  if (!d.gratis) {
    const conPrecio = d.entradas.filter((e) => limpio(e.nombre) || limpio(e.precio));
    if (conPrecio.length === 0) errores.push("Agrega al menos un tipo de entrada con su precio, o marca el evento como gratis.");
    conPrecio.forEach((e, i) => {
      if (!limpio(e.nombre)) errores.push(`Ponle nombre a la entrada ${i + 1} (ej. "General").`);
      if (monto(e.precio) == null) errores.push(`Escribe el precio de la entrada "${limpio(e.nombre) || i + 1}".`);
    });
    if (new Set(conPrecio.map((e) => limpio(e.nombre).toLowerCase())).size < conPrecio.length) errores.push("Hay dos entradas con el mismo nombre.");
  }
  if (!FORMAS_COMPRA.some((f) => f.id === d.formaCompra)) errores.push("Elige cómo se consiguen las entradas.");
  if (d.formaCompra === "link" && !esLink(limpio(d.enlace))) errores.push("Escribe el link de compra completo (https://...).");
  if (d.formaCompra === "contacto" && !limpio(d.contacto)) errores.push("Escribe el teléfono, WhatsApp o correo de contacto.");
  if (d.formaCompra === "inscripcion" && !esLink(limpio(d.enlace)) && !limpio(d.contacto)) errores.push("Para la inscripción, escribe un link o un contacto.");
  if (limpio(d.enlace) && !esLink(limpio(d.enlace))) errores.push("El link debe empezar con https://");
  return errores;
}

const delGrupo = (grupo: string) => ({ fuenteId: FUENTE_MANUAL.id, idExterno: { startsWith: `${grupo}/` } });

// Crea o reemplaza un evento manual (todas sus funciones). Devuelve el grupo.
export async function guardarEvento(d: DatosEvento, grupoExistente?: string): Promise<string> {
  const grupo = grupoExistente ?? randomUUID().slice(0, 8);
  const comuna = ubicarComuna(d.lugar.comuna).comuna ?? d.lugar.comuna;

  const entradas = d.gratis
    ? []
    : d.entradas
        .filter((e) => limpio(e.nombre) && monto(e.precio) != null)
        .map((e) => ({ nombre: limpio(e.nombre), precio: monto(e.precio)!, total: monto(e.precio)!, agotado: e.agotado }));
  const precios = entradas.map((e) => e.precio);
  const precioMin = d.gratis ? 0 : Math.min(...precios);
  const precioMax = d.gratis ? 0 : Math.max(...precios);
  const agotado = entradas.length > 0 && entradas.every((e) => e.agotado);
  const enlace = limpio(d.enlace);
  const url = (d.formaCompra === "link" || d.formaCompra === "inscripcion") && esLink(enlace) ? enlace : "";
  const ahora = new Date();
  // Nunca le toca a un scraper revisarlo.
  const nunca = new Date("2999-12-31T00:00:00Z");

  await prisma.$transaction(async (tx) => {
    await tx.fuente.upsert({
      where: { id: FUENTE_MANUAL.id },
      update: {},
      create: { id: FUENTE_MANUAL.id, nombre: FUENTE_MANUAL.nombre, urlListado: "", activa: true, horasEntreListados: 24 },
    });
    const recinto = await tx.recinto.upsert({
      where: { nombre_comuna: { nombre: limpio(d.lugar.nombre), comuna } },
      update: { direccion: limpio(d.lugar.direccion) },
      create: { nombre: limpio(d.lugar.nombre), comuna, direccion: limpio(d.lugar.direccion) },
    });

    // Se reemplazan todas las funciones: así agregar o quitar fechas es simple.
    const anteriores = await tx.evento.findMany({ where: delGrupo(grupo), select: { primeraVezVistoEn: true } });
    await tx.evento.deleteMany({ where: delGrupo(grupo) });

    const funciones = [...d.funciones].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    for (const [i, f] of funciones.entries()) {
      await tx.evento.create({
        data: {
          fuenteId: FUENTE_MANUAL.id,
          idExterno: `${grupo}/${i + 1}`,
          nombre: limpio(d.nombre),
          artista: oNulo(d.artista),
          url,
          imagenUrl: oNulo(d.imagenUrl),
          categoria: d.categoria,
          generoOriginal: d.categoria === CATEGORIA_MUSICA ? oNulo(d.genero) : null,
          categoriaFuente: "manual",
          descripcion: oNulo(d.descripcion),
          fechaInicio: f.fecha,
          fechaFin: limpio(f.fechaFin) || f.fecha,
          hora: oNulo(f.hora),
          recintoId: recinto.id,
          precioBaseMin: precioMin,
          precioTotalMin: precioMin,
          precioTotalMax: precioMax,
          moneda: "CLP",
          agotado,
          activo: d.visible,
          primeraVezVistoEn: anteriores[0]?.primeraVezVistoEn ?? ahora,
          ultimaVezVistoEn: ahora,
          detalleActualizadoEn: ahora,
          proximaRevisionDetalle: nunca,
          sectores: { create: entradas },
          manual: { create: { formaCompra: d.formaCompra, contacto: oNulo(d.contacto) } },
        },
      });
    }
  });
  return grupo;
}

export async function listarEventosManuales() {
  const filas = await prisma.evento.findMany({
    where: { fuenteId: FUENTE_MANUAL.id },
    include: { recinto: true },
    orderBy: [{ fechaInicio: "asc" }, { hora: "asc" }],
  });
  const hoy = hoyEnChile();
  const grupos = new Map<string, typeof filas>();
  for (const e of filas) {
    const g = e.idExterno.split("/")[0];
    grupos.set(g, [...(grupos.get(g) ?? []), e]);
  }
  return [...grupos].map(([grupo, fs]) => {
    const proxima = fs.find((f) => (f.fechaFin ?? f.fechaInicio ?? "") >= hoy);
    return {
      grupo,
      nombre: fs[0].nombre,
      categoria: fs[0].categoria,
      lugar: fs[0].recinto ? `${fs[0].recinto.nombre} · ${fs[0].recinto.comuna}` : "",
      funciones: fs.length,
      proxima: proxima?.fechaInicio ?? null,
      ultima: fs[fs.length - 1].fechaFin ?? fs[fs.length - 1].fechaInicio,
      visible: fs[0].activo,
      gratis: fs[0].precioBaseMin === 0,
      imagen: fs[0].imagenUrl,
    };
  });
}

// Los datos de un evento manual tal como los muestra el formulario.
export async function leerEvento(grupo: string): Promise<DatosEvento | null> {
  const fs = await prisma.evento.findMany({
    where: delGrupo(grupo),
    include: { recinto: true, sectores: true, manual: true },
    orderBy: [{ fechaInicio: "asc" }, { hora: "asc" }],
  });
  if (fs.length === 0) return null;
  const e = fs[0];
  const lugar = ubicarComuna(e.recinto?.comuna);
  return {
    nombre: e.nombre,
    artista: e.artista ?? "",
    categoria: e.categoria,
    genero: e.generoOriginal ?? "",
    descripcion: e.descripcion ?? "",
    funciones: fs.map((f) => ({ fecha: f.fechaInicio ?? "", hora: f.hora ?? "", fechaFin: f.fechaFin && f.fechaFin !== f.fechaInicio ? f.fechaFin : "" })),
    lugar: { nombre: e.recinto?.nombre ?? "", region: lugar.region ?? "", comuna: lugar.comuna ?? "", direccion: e.recinto?.direccion ?? "" },
    imagenUrl: e.imagenUrl ?? "",
    gratis: e.precioBaseMin === 0 && e.sectores.length === 0,
    entradas: e.sectores
      .sort((a, b) => (a.precio ?? 0) - (b.precio ?? 0))
      .map((s) => ({ nombre: s.nombre, precio: String(s.precio ?? s.total ?? ""), agotado: Boolean(s.agotado) })),
    formaCompra: (e.manual?.formaCompra as FormaCompra) ?? "link",
    enlace: e.url,
    contacto: e.manual?.contacto ?? "",
    visible: e.activo,
  };
}

export async function cambiarVisibilidadEvento(grupo: string, visible: boolean) {
  await prisma.evento.updateMany({ where: delGrupo(grupo), data: { activo: visible } });
}

export async function borrarEvento(grupo: string) {
  await prisma.evento.deleteMany({ where: delGrupo(grupo) });
}

// ── Locales ─────────────────────────────────────────────────────────────

export function validarLocal(d: DatosLocal): Errores {
  const errores: Errores = [];
  if (!limpio(d.nombre)) errores.push("Escribe el nombre del local.");
  if (!TIPOS_LOCAL.some((t) => t.id === d.tipo)) errores.push("Elige el tipo de local.");
  if (!limpio(d.genero)) errores.push(d.musicaEnVivo ? "Escribe el estilo de música (ej. Rock, Jazz)." : "Escribe el tipo de cocina o especialidad.");
  validarLugar(d.region, d.comuna, d.direccion, errores);
  if (!NIVELES_PRECIO.includes(d.nivelPrecio)) errores.push("Elige el nivel de precio.");
  if (limpio(d.sitioWeb) && !esLink(limpio(d.sitioWeb))) errores.push("El sitio web debe empezar con https://");
  d.programacion.forEach((s, i) => {
    if (!DIAS_SEMANA.includes(s.dia)) errores.push(`Elige el día del show ${i + 1}.`);
    if (!limpio(s.evento)) errores.push(`Escribe qué hay en el show ${i + 1} (ej. "Jam session").`);
    if (!HORA.test(s.hora)) errores.push(`La hora del show ${i + 1} debe ser como 22:00.`);
  });
  return errores;
}

function datosBar(d: DatosLocal) {
  return {
    nombre: limpio(d.nombre),
    tipo: d.tipo,
    musicaEnVivo: d.musicaEnVivo,
    genero: limpio(d.genero),
    descripcion: oNulo(d.descripcion),
    comuna: ubicarComuna(d.comuna).comuna ?? d.comuna,
    direccion: limpio(d.direccion),
    imagenUrl: oNulo(d.imagenUrl),
    horario: oNulo(d.horario),
    telefono: oNulo(d.telefono),
    instagram: oNulo(d.instagram),
    sitioWeb: oNulo(d.sitioWeb),
    nivelPrecio: d.nivelPrecio,
    entradaLiberada: d.entradaLiberada,
    activo: d.visible,
  };
}

export async function guardarLocal(d: DatosLocal, id?: number): Promise<number> {
  const programacion = d.musicaEnVivo ? d.programacion.map((s) => ({ dia: s.dia, evento: limpio(s.evento), hora: s.hora })) : [];
  if (id == null) {
    const b = await prisma.bar.create({ data: { ...datosBar(d), programacion: { create: programacion } } });
    return b.id;
  }
  await prisma.$transaction([
    prisma.showBar.deleteMany({ where: { barId: id } }),
    // Al editar un local de ejemplo deja de ser ejemplo: ya tiene datos reales.
    prisma.bar.update({ where: { id }, data: { ...datosBar(d), esEjemplo: false, programacion: { create: programacion } } }),
  ]);
  return id;
}

export async function listarLocales() {
  const bares = await prisma.bar.findMany({ include: { _count: { select: { programacion: true } } }, orderBy: { nombre: "asc" } });
  return bares.map((b) => ({
    id: b.id,
    nombre: b.nombre,
    tipo: b.tipo,
    comuna: b.comuna,
    region: ubicarComuna(b.comuna).region,
    musicaEnVivo: b.musicaEnVivo,
    shows: b._count.programacion,
    visible: b.activo,
    esEjemplo: b.esEjemplo,
    imagen: b.imagenUrl,
  }));
}

export async function leerLocal(id: number): Promise<DatosLocal | null> {
  const b = await prisma.bar.findUnique({ where: { id }, include: { programacion: true } });
  if (!b) return null;
  const lugar = ubicarComuna(b.comuna);
  return {
    nombre: b.nombre,
    tipo: b.tipo as TipoLocal,
    musicaEnVivo: b.musicaEnVivo,
    genero: b.genero,
    descripcion: b.descripcion ?? "",
    region: lugar.region ?? "",
    comuna: lugar.comuna ?? b.comuna,
    direccion: b.direccion ?? "",
    imagenUrl: b.imagenUrl ?? "",
    horario: b.horario ?? "",
    telefono: b.telefono ?? "",
    instagram: b.instagram ?? "",
    sitioWeb: b.sitioWeb ?? "",
    nivelPrecio: b.nivelPrecio,
    entradaLiberada: b.entradaLiberada,
    programacion: b.programacion
      .sort((x, y) => DIAS_SEMANA.indexOf(x.dia) - DIAS_SEMANA.indexOf(y.dia) || x.hora.localeCompare(y.hora))
      .map((s) => ({ dia: s.dia, evento: s.evento, hora: s.hora })),
    visible: b.activo,
  };
}

export async function cambiarVisibilidadLocal(id: number, visible: boolean) {
  await prisma.bar.update({ where: { id }, data: { activo: visible } });
}

export async function borrarLocal(id: number) {
  await prisma.bar.delete({ where: { id } });
}

// Lugares ya usados (locales y recintos de eventos manuales), para no
// escribir la misma dirección dos veces.
export async function lugaresConocidos() {
  const [bares, recintos] = await Promise.all([
    prisma.bar.findMany({ where: { esEjemplo: false }, select: { nombre: true, comuna: true, direccion: true } }),
    prisma.recinto.findMany({ where: { eventos: { some: { fuenteId: FUENTE_MANUAL.id } } }, select: { nombre: true, comuna: true, direccion: true } }),
  ]);
  const vistos = new Set<string>();
  return [...bares, ...recintos]
    .map((l) => ({ nombre: l.nombre, ...ubicarComuna(l.comuna), direccion: l.direccion ?? "" }))
    .filter((l) => l.region && l.comuna && !vistos.has(`${l.nombre}|${l.comuna}`) && vistos.add(`${l.nombre}|${l.comuna}`))
    .map((l) => ({ nombre: l.nombre, region: l.region!, comuna: l.comuna!, direccion: l.direccion }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export type LugarConocido = Awaited<ReturnType<typeof lugaresConocidos>>[number];

// ── Fotos ───────────────────────────────────────────────────────────────

export const TAMANO_MAXIMO_FOTO = 3 * 1024 * 1024;

export async function guardarFoto(archivo: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) throw new Error("La foto debe ser JPG, PNG o WebP.");
  if (archivo.size > TAMANO_MAXIMO_FOTO) throw new Error("La foto pesa demasiado (máximo 3 MB).");
  const img = await prisma.imagen.create({ data: { tipo: archivo.type, datos: new Uint8Array(await archivo.arrayBuffer()) } });
  return `/imagenes/${img.id}`;
}

// ── Fuentes ─────────────────────────────────────────────────────────────

export async function guardarFuente(id: string, datos: { activa: boolean; horasEntreListados: number; diasDelMes: string | null }): Promise<Errores> {
  const errores: Errores = [];
  if (!Number.isInteger(datos.horasEntreListados) || datos.horasEntreListados < 1 || datos.horasEntreListados > 24 * 31) {
    errores.push("La frecuencia debe ser un número de horas entre 1 y 744.");
  }
  let dias: string | null = null;
  if (datos.diasDelMes) {
    const lista = datos.diasDelMes.split(/[,\s]+/).filter(Boolean).map(Number);
    if (lista.some((n) => !Number.isInteger(n) || n < 1 || n > 31)) errores.push("Los días del mes deben ser números del 1 al 31, separados por coma.");
    dias = [...new Set(lista)].sort((a, b) => a - b).join(",");
  }
  if (errores.length) return errores;
  await prisma.fuente.update({ where: { id }, data: { activa: datos.activa, horasEntreListados: datos.horasEntreListados, diasDelMes: dias } });
  return [];
}

// Géneros de música ya usados en el sitio, para sugerirlos al escribir.
export async function generosConocidos(): Promise<string[]> {
  const [eventos, bares] = await Promise.all([
    prisma.evento.findMany({
      where: { activo: true, categoria: CATEGORIA_MUSICA, generoOriginal: { not: null } },
      distinct: ["generoOriginal"],
      select: { generoOriginal: true },
    }),
    prisma.bar.findMany({ where: { musicaEnVivo: true }, distinct: ["genero"], select: { genero: true } }),
  ]);
  return [...new Set([...eventos.map((e) => e.generoOriginal!), ...bares.map((b) => b.genero)])].sort((a, b) => a.localeCompare(b, "es"));
}
