import type { Role } from "@prisma/client";
import type { NextAuthConfig } from "next-auth";

/**
 * Configuración de Auth.js segura para el Edge Runtime: solo lee/firma
 * la sesión (JWT), sin ningún proveedor con lógica de autorización
 * (esa lógica usa bcrypt/Prisma/nodemailer, incompatibles con Edge).
 * La usan `middleware.ts` (vía NextAuth(authConfig).auth, Edge) y
 * `src/auth.ts` (que añade los proveedores reales, Node.js).
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.organizationId = user.organizationId;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      // Auth.js guarda el id del usuario en `token.sub`; sin él,
      // getCurrentUser() devuelve null y el panel redirige a /login.
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (token.organizationId) {
        session.user.organizationId = token.organizationId as string;
      }
      if (token.role) {
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};
