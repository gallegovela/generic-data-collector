import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Salida standalone: la imagen Docker de producción solo copia
  // .next/standalone y .next/static (ver Dockerfile).
  output: "standalone",
  // `cacheComponents`/`partialPrefetching` (activados por defecto por
  // `create-next-app`, no es una decisión de ningún módulo de specs/)
  // se desactivan: su validación de "instant UI" interactúa mal con
  // la lectura de sesión de Auth.js (JWT, aleatoriedad en el
  // descifrado) y producía redirecciones a /login para usuarios ya
  // autenticados en /admin. Todos los módulos siguientes dependen de
  // leer la sesión en cada petición, así que se prioriza que ese
  // camino funcione siempre (CLAUDE.md: "que la demostración
  // funcione de principio a fin sin fallos") sobre esta optimización
  // experimental.
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
