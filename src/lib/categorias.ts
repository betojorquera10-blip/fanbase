// Categorías de eventos. El sitio separa "Música" de todo lo demás (teatro,
// exposiciones, cine...), así que la única que importa comparar es esta.
// Archivo aparte para que el navegador lo pueda usar sin cargar la base.

export const CATEGORIA_MUSICA = "Música";

// "musica": solo música · "otros": todo lo que no es música · "todos": ambos
export type TipoEvento = "musica" | "otros" | "todos";
