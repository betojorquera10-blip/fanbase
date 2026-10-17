// Descarga de páginas, compartida por todos los scrapers.

// Algunos sitios devuelven otra página (o bloquean) si el user-agent no es de
// un navegador. Lo compensamos siendo respetuosos: pocas solicitudes, con pausas.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const TIMEOUT_MS = 20_000;

// Contadores de la corrida actual, para registrar cuánto descarga cada
// ejecución (útil para estimar costos de servidor y tráfico).
const estadisticas = { solicitudes: 0, bytes: 0 };

export function reiniciarEstadisticas() {
  estadisticas.solicitudes = 0;
  estadisticas.bytes = 0;
}

export function leerEstadisticas() {
  return { ...estadisticas };
}

// `timeoutMs`: algunos sitios (ej. la agenda de Las Condes) a veces tardan más de un minuto.
export async function descargarHtml(url: string, { timeoutMs = TIMEOUT_MS } = {}): Promise<string> {
  estadisticas.solicitudes++;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-CL,es;q=0.9",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  const html = await res.text();
  estadisticas.bytes += Buffer.byteLength(html);
  return html;
}

export function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
