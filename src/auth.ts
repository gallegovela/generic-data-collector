import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { authorizeMagicLink, authorizePassword } from "@/server/auth/authorize";

// Config completa (Node.js): añade los dos proveedores Credentials
// sobre la base común de `authConfig` (ver src/auth.config.ts, que es
// la que usa `middleware.ts` en el Edge Runtime, sin esta lógica).
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "password",
      name: "Contraseña",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: authorizePassword,
    }),
    Credentials({
      id: "magic-link",
      name: "Enlace mágico",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      authorize: authorizeMagicLink,
    }),
  ],
});
