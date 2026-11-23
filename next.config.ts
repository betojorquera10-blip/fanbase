import type { NextConfig } from "next";
import { SERVIDORES_IMAGENES } from "./src/lib/imagenes";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Se fija al construir: staging en Netlify no se indexa (ver src/lib/indexacion.ts).
  env: {
    FANBASE_NO_INDEXAR: process.env.NETLIFY === "true" || process.env.NO_INDEXAR === "1" ? "1" : "",
  },
  experimental: {
    // Las fotos del panel de administración llegan achicadas (unos cientos de
    // KB), pero una foto muy detallada puede pasar el límite de 1 MB por defecto.
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    // Afiches de los eventos (lista en src/lib/imagenes.ts).
    remotePatterns: SERVIDORES_IMAGENES.map((s) => ({ protocol: "https" as const, ...s })),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
