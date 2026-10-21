// ¿Deben los buscadores indexar este sitio? No en staging: el sitio de pruebas
// en Netlify competiría con el de producción y mostraría cambios sin aprobar.
// Netlify define NETLIFY=true al construir; NO_INDEXAR=1 permite forzarlo en
// cualquier otro lugar. Producción (VPS) no define ninguna de las dos.
export const permitirIndexacion = process.env.NETLIFY !== "true" && process.env.NO_INDEXAR !== "1";
