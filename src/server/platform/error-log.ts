/**
 * Registro mínimo de errores del servidor. Se llama desde
 * `onRequestError` (instrumentation.ts) para cada error no capturado en
 * route handlers, server components y server actions.
 *
 * Por el RGPD no se escribe el mensaje del error (puede llevar valores
 * introducidos por el usuario), ni la URL real (tokens, query string),
 * ni cabeceras: solo la plantilla de la ruta, el tipo de error y la pila.
 *
 * Cubre: RNF-PLT-05, CA-PLT-05.
 */

/** Subconjunto de los argumentos de `onRequestError` de Next.js que se usan. */
export type RequestErrorRequest = { method: string };
export type RequestErrorContext = {
  routePath: string;
  routeType: string;
  renderSource?: string;
};

export type RequestErrorLog = {
  level: "error";
  event: "request_error";
  time: string;
  method: string;
  route: string;
  routeType: string;
  renderSource?: string;
  name: string;
  code?: string;
  digest?: string;
  stack?: string[];
};

const MAX_STACK_FRAMES = 10;

function stringProp(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const prop = (value as Record<string, unknown>)[key];
  return typeof prop === "string" ? prop : undefined;
}

/** Solo las líneas "at ..." de la pila: la primera línea lleva el mensaje. */
function stackFrames(stack: string | undefined): string[] | undefined {
  if (!stack) return undefined;
  const frames = stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "))
    .slice(0, MAX_STACK_FRAMES);
  return frames.length > 0 ? frames : undefined;
}

export function buildRequestErrorLog(
  error: unknown,
  request: RequestErrorRequest,
  context: RequestErrorContext,
  now: Date = new Date(),
): RequestErrorLog {
  const isError = error instanceof Error;
  const entry: RequestErrorLog = {
    level: "error",
    event: "request_error",
    time: now.toISOString(),
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
    name: isError ? error.name : "NonError",
  };

  if (context.renderSource) entry.renderSource = context.renderSource;
  const code = stringProp(error, "code");
  if (code) entry.code = code;
  const digest = stringProp(error, "digest");
  if (digest) entry.digest = digest;
  const stack = stackFrames(isError ? error.stack : undefined);
  if (stack) entry.stack = stack;

  return entry;
}

export function logRequestError(
  error: unknown,
  request: RequestErrorRequest,
  context: RequestErrorContext,
): void {
  try {
    console.error(JSON.stringify(buildRequestErrorLog(error, request, context)));
  } catch {
    // El registro nunca debe romper la respuesta.
  }
}
