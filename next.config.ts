import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Salida standalone: la imagen Docker de producción solo copia
  // .next/standalone y .next/static (ver Dockerfile).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
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
