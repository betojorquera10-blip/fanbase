// ¿Deben los buscadores indexar este sitio? No en staging: el sitio de pruebas
// en Netlify competiría con el de producción y mostraría cambios sin aprobar.
//
// FANBASE_NO_INDEXAR se fija al CONSTRUIR (next.config.ts, opción `env`): vale
// "1" si se construye en Netlify (NETLIFY=true) o con NO_INDEXAR=1. Queda
// incorporado en el código porque las páginas se regeneran después en
// servidores de Netlify donde esas variables ya no existen. Producción (VPS)
// no define ninguna de las dos.
export const permitirIndexacion = process.env.FANBASE_NO_INDEXAR !== "1";
