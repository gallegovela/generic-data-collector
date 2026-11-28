/** `AUTH_URL` si está definida y no vacía (sin barra final); si no, el origen de la petición. */
export function resolveBaseUrl(request: { nextUrl: { origin: string } }): string {
  const configured = process.env.AUTH_URL?.trim();
  return configured ? configured.replace(/\/+$/, "") : request.nextUrl.origin;
}
