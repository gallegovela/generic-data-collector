import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Aumenta los tipos de Auth.js v5 con los campos propios de este
// módulo (organizationId, role), que viajan en el JWT de sesión.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizationId: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    organizationId: string;
    role: Role;
  }
}

// No se aumenta "next-auth/jwt": `JWT` ya extiende `Record<string,
// unknown>` en @auth/core, así que `token.organizationId = ...` no
// necesita tipos adicionales para escribir; al leerlo en el callback
// `session`, se usa un cast explícito (ver src/auth.ts).
