import type { NextConfig } from "next";
import { SERVIDORES_IMAGENES } from "./src/lib/imagenes";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
