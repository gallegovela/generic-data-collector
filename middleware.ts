import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Instancia propia de Auth.js solo con `authConfig` (sin proveedores
// ni sus dependencias de Node.js como bcrypt/Prisma/nodemailer): el
// middleware corre en el Edge Runtime, que no las soporta. `src/auth.ts`
// (Node.js) añade los proveedores reales para el resto de la app.
const { auth } = NextAuth(authConfig);

/**
 * Guardián de sesión de `/admin/**` (solo `admin`) y `/forms/**`
 * (cualquier sesión). Un collector en `/admin` va a `/forms`. `/f/**` queda fuera del `matcher` a propósito:
 * es la infraestructura de RF-AUT-08 para que el relleno público de
 * formularios no pase por el guardián de sesión.
 *
 * Cubre: RF-AUT-06, CA-AUT-02.
 */
export default auth((req) => {
  const { nextUrl } = req;
  const user = req.auth?.user;

  if (!user) {
    const loginUrl = new URL("/login", nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  if (nextUrl.pathname.startsWith("/admin") && user.role !== "admin") {
    return NextResponse.redirect(new URL("/forms", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/forms/:path*"],
};
