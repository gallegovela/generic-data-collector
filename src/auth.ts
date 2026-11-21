import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { loginSchema } from "@/lib/auth/auth.schema";
import { verifyMagicLink, verifyPassword } from "@/server/auth/auth.service";
import type { CurrentUser } from "@/server/auth/session";

function toAuthUser(user: CurrentUser) {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

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
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        try {
          const user = await verifyPassword(parsed.data.email, parsed.data.password);
          return toAuthUser(user);
        } catch {
          return null;
        }
      },
    }),
    Credentials({
      id: "magic-link",
      name: "Enlace mágico",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const token = credentials?.token;

        if (typeof token !== "string" || token.length === 0) {
          return null;
        }

        try {
          const user = await verifyMagicLink(token);
          return toAuthUser(user);
        } catch {
          return null;
        }
      },
    }),
  ],
});
