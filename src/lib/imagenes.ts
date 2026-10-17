// Servidores de afiches que Next.js optimiza (los usa next.config.ts). Una
// imagen de otro servidor se muestra igual, sin optimizar: así una fuente que
// cambia de servidor nunca rompe la página.

export const SERVIDORES_IMAGENES = [
  { hostname: "static.ptocdn.net", pathname: "/images/**" }, // Puntoticket
  { hostname: "agendacultural.culturallascondes.cl", pathname: "/wp-content/uploads/**" }, // Las Condes
  { hostname: "ticketing-uploads-1.ticketplus.global", pathname: "/images/**" }, // Ticketplus
  { hostname: "ticketing.assets.ticketplus.global", pathname: "/assets/**" }, // Ticketplus
  { hostname: "cdn.getcrowder.com", pathname: "/images/**" }, // Ticketmaster
  { hostname: "vitacuracultura.cl", pathname: "/wp-content/uploads/**" }, // Vitacura
  { hostname: "culturalareina.cl", pathname: "/wp-content/uploads/**" }, // La Reina
];

export function imagenOptimizable(url: string): boolean {
  try {
    const { protocol, hostname, pathname } = new URL(url);
    return protocol === "https:" && SERVIDORES_IMAGENES.some((s) => s.hostname === hostname && pathname.startsWith(s.pathname.replace("/**", "/")));
  } catch {
    return false;
  }
}
