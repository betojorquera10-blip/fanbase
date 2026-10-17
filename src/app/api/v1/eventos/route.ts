// GET /api/v1/eventos — búsqueda de eventos para clientes externos (ej. el
// agente de WhatsApp). Requiere el header `x-api-key` con FANBASE_API_KEY.
//
// Parámetros (todos opcionales):
//   fin_de_semana=1        próximo fin de semana (viernes a domingo); si hoy ya es
//                          fin de semana, el actual. Ignora desde/hasta.
//   desde, hasta           rango de fechas YYYY-MM-DD (desde = hoy por defecto)
//   precio_min, precio_max rango en CLP por entrada: el evento aparece si ALGUNA de
//                          sus entradas está en el rango (se puede usar solo uno)
//   tipo_precio            base (por defecto) | total (precio + cargo por servicio)
//   genero                 texto, ej. rock — sin importar mayúsculas ni tildes
//   q                      busca en nombre del evento, artista y descripción
//   tipo                   musica (por defecto) | otros (teatro, exposiciones, cine...) | todos
//   incluir_agotados=1     por defecto se excluyen los agotados
//   limite                 1 a 100 (20 por defecto)
//
// Ejemplo: /api/v1/eventos?fin_de_semana=1&precio_max=10000&genero=rock
//          /api/v1/eventos?precio_min=10000&precio_max=30000

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { buscarEventos, proximoFinDeSemana, LIMITE_MAXIMO, type FiltrosEventos } from "@/lib/eventos";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function claveValida(recibida: string | null): boolean {
  const esperada = process.env.FANBASE_API_KEY;
  if (!esperada || !recibida) return false;
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  // Comparación en tiempo constante: no revela cuántos caracteres coinciden.
  return a.length === b.length && timingSafeEqual(a, b);
}

function error(status: number, mensaje: string) {
  return Response.json({ error: mensaje }, { status });
}

export async function GET(request: NextRequest) {
  if (!process.env.FANBASE_API_KEY) return error(500, "La API no está configurada (falta FANBASE_API_KEY).");
  if (!claveValida(request.headers.get("x-api-key"))) return error(401, "Falta el header x-api-key o no es válido.");

  const p = request.nextUrl.searchParams;
  const si = (nombre: string) => ["1", "true", "si", "sí"].includes((p.get(nombre) ?? "").toLowerCase());
  const filtros: FiltrosEventos = {};

  if (si("fin_de_semana")) {
    Object.assign(filtros, proximoFinDeSemana());
  } else {
    for (const campo of ["desde", "hasta"] as const) {
      const v = p.get(campo);
      if (v == null) continue;
      if (!FECHA.test(v)) return error(400, `"${campo}" debe tener formato YYYY-MM-DD.`);
      filtros[campo] = v;
    }
  }

  for (const [param, campo] of [["precio_min", "precioMin"], ["precio_max", "precioMax"]] as const) {
    const v = p.get(param);
    if (v == null) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return error(400, `"${param}" debe ser un número en pesos, ej. 10000.`);
    filtros[campo] = n;
  }
  if (filtros.precioMin != null && filtros.precioMax != null && filtros.precioMin > filtros.precioMax) {
    return error(400, '"precio_min" no puede ser mayor que "precio_max".');
  }

  const tipoPrecio = p.get("tipo_precio");
  if (tipoPrecio != null) {
    if (tipoPrecio !== "base" && tipoPrecio !== "total") return error(400, '"tipo_precio" debe ser "base" o "total".');
    filtros.tipoPrecio = tipoPrecio;
  }

  const limite = p.get("limite");
  if (limite != null) {
    const n = Number(limite);
    if (!Number.isInteger(n) || n < 1 || n > LIMITE_MAXIMO) return error(400, `"limite" debe ser un entero entre 1 y ${LIMITE_MAXIMO}.`);
    filtros.limite = n;
  }

  const tipo = p.get("tipo");
  if (tipo != null) {
    if (tipo !== "musica" && tipo !== "otros" && tipo !== "todos") return error(400, '"tipo" debe ser "musica", "otros" o "todos".');
    filtros.tipo = tipo;
  }

  filtros.genero = p.get("genero") ?? undefined;
  filtros.texto = p.get("q") ?? undefined;
  filtros.incluirAgotados = si("incluir_agotados");

  return Response.json(await buscarEventos(filtros));
}
