// Días de la semana tal como se guardan en bares_programacion (enum dia_semana).
// Archivo aparte para que el navegador lo pueda usar sin cargar la base.

export const DIAS_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

const NOMBRES: Record<DiaSemana, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

export const nombreDia = (dia: DiaSemana) => NOMBRES[dia];

// "2026-10-17" → "sabado"
export function diaSemanaDe(fecha: string): DiaSemana {
  const n = new Date(`${fecha}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return DIAS_SEMANA[(n + 6) % 7];
}
