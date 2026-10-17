// Frecuencias de actualización, compartidas por todos los scrapers y
// configurables en la base sin tocar código:
//   - Listado (tabla fuentes): dias_del_mes ("1,2,3" → solo esos días del mes,
//     en Chile; null = cualquier día) y horas_entre_listados.
//   - Detalle de cada evento (tabla reglas_frecuencia): más seguido mientras
//     más cerca está el evento.

import { prisma } from "@/lib/db";
import { hoyEnChile } from "@/lib/fechas";

export const HORA_MS = 60 * 60 * 1000;

interface ConfiguracionFuente {
  horasEntreListados: number;
  diasDelMes: string | null;
  ultimoListadoEn: Date | null;
}

export function tocaListado(fuente: ConfiguracionFuente, hoy = hoyEnChile()): { toca: boolean; motivo: string } {
  if (fuente.diasDelMes) {
    const dias = fuente.diasDelMes.split(",").map((d) => Number(d.trim()));
    if (!dias.includes(Number(hoy.slice(8, 10)))) {
      return { toca: false, motivo: `solo se lee los días ${fuente.diasDelMes} de cada mes` };
    }
  }
  if (fuente.ultimoListadoEn && Date.now() - fuente.ultimoListadoEn.getTime() < fuente.horasEntreListados * HORA_MS) {
    return { toca: false, motivo: `al día (último: ${fuente.ultimoListadoEn.toLocaleString("es-CL")})` };
  }
  return { toca: true, motivo: "" };
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / (24 * HORA_MS));
}

// Se aplica la primera regla (por `orden`) cuyo dias_hasta_evento_max sea >=
// los días que faltan para el evento.
export async function horasHastaProximaRevision(fechaInicio: string | null): Promise<number> {
  const reglas = await prisma.reglaFrecuencia.findMany({ orderBy: { orden: "asc" } });
  if (reglas.length === 0) return 24; // sin reglas configuradas: una vez al día
  const dias = fechaInicio ? diasEntre(hoyEnChile(), fechaInicio) : Number.POSITIVE_INFINITY;
  const regla =
    reglas.find((r) => r.diasHastaEventoMax == null || dias <= r.diasHastaEventoMax) ?? reglas[reglas.length - 1];
  return regla.horasEntreRevisiones;
}
