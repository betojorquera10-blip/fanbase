// Fechas en hora de Chile como texto "YYYY-MM-DD". No dependen de la base de
// datos, así que las usan tanto el servidor como el navegador.

// Fecha de hoy en Chile como "YYYY-MM-DD" (independiente de la zona horaria del servidor).
export function hoyEnChile(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`); // mediodía UTC: sumar días nunca cruza de fecha por horario de verano
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Fin de semana = viernes a domingo (en Chile los conciertos del viernes en la
// noche cuentan como "el fin de semana"). Si hoy ya es viernes, sábado o
// domingo, devuelve el fin de semana en curso, desde hoy.
export function proximoFinDeSemana(hoy = hoyEnChile()): { desde: string; hasta: string } {
  const diaSemana = new Date(`${hoy}T12:00:00Z`).getUTCDay(); // 0 = domingo ... 6 = sábado
  if (diaSemana === 0) return { desde: hoy, hasta: hoy };
  if (diaSemana >= 5) return { desde: hoy, hasta: sumarDias(hoy, 7 - diaSemana) };
  return { desde: sumarDias(hoy, 5 - diaSemana), hasta: sumarDias(hoy, 7 - diaSemana) };
}

// "2026-10-17" → "sáb 17 oct". Siempre igual en servidor y navegador.
export function formatearFecha(fecha: string): string {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-CL", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// "Electrónica" → "electronica", para comparar sin importar tildes ni mayúsculas.
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
