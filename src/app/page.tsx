import { cacheLife, cacheTag } from "next/cache";
import { buscarEventos } from "@/lib/eventos";
import { listarBares } from "@/lib/bares";
import { Explorador } from "./explorador";

// Toda la cartelera (música, agenda cultural y locales) se lee de la base y se
// guarda unos minutos, sin consultar la base en cada visita. Los cambios hechos
// en el panel de administración la refrescan al tiro (etiqueta "cartelera").
// Los filtros corren en el navegador.
async function cartelera() {
  "use cache";
  cacheLife("minutes");
  cacheTag("cartelera");
  const [{ eventos }, bares] = await Promise.all([
    buscarEventos({ tipo: "todos", incluirAgotados: true, limite: 1000 }),
    listarBares(),
  ]);
  return { eventos, bares };
}

export default async function Home() {
  const { eventos, bares } = await cartelera();
  return <Explorador eventos={eventos} bares={bares} />;
}
