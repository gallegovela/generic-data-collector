# Plataforma base — Diseño técnico

- **Requisitos:** [README.md](README.md)
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #3 (diseño), padre #1

## Resumen

Se crea el proyecto Next.js (App Router + TypeScript estricto) con las herramientas oficiales (`create-next-app`, `shadcn init`, `prisma init`), sin modelos de negocio todavía. Se añaden `docker-compose.yml` (PostgreSQL, MinIO, Mailpit) para desarrollo local y `docker-compose.prod.yml` con el contenedor de la aplicación para la demo. La validación de variables de entorno se hace una vez, al arrancar el servidor, con un esquema Zod cargado desde `instrumentation.ts`. Se expone `GET /api/health` para comprobar base de datos y almacenamiento. La CI (`tests.yml`) se reescribe para Node/Next.js; `deploy.yml` se adapta para usar el fichero `docker-compose.prod.yml` y para generar `.env` a partir de `.env.example` y del environment `ionosL1` de GitHub, pero mantiene el runner propio y la estrategia ya existentes (ver [Despliegue](#despliegue)). Cada módulo posterior añade sus propias variables de entorno, dependencias, modelos y migraciones; este módulo no las incluye.

## Modelo de datos

```prisma
// prisma/schema.prisma — solo los bloques base; sin modelos todavía
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

- Sin modelos ni migraciones en este módulo: `tenancy-auth` (#4) añade `Organization`/`User` y la primera migración real.
- `npm run db:migrate` ejecuta `prisma migrate deploy`: con el esquema vacío no aplica nada y termina en 0, lo que ya cumple RF-PLT-02 (el comando existe y no falla). Para crear migraciones nuevas durante el desarrollo de otros módulos se usa `npx prisma migrate dev --name <nombre>` directamente (no hace falta un script propio).
- `package.json` incluye `"postinstall": "prisma generate"` para que el cliente de Prisma se regenere tras `npm install` (por ejemplo, en la imagen Docker).
- `package.json` también declara `"prisma": { "seed": "tsx prisma/seed.ts" }` para que `npx prisma db seed` (invocado por `npm run db:seed`) sepa qué script ejecutar. No se añade `prisma.config.ts`: no hace falta ninguna opción que ese fichero resuelva y que `package.json` no cubra ya.

## Estructura de ficheros

| Capa | Ruta | Responsabilidad |
| --- | --- | --- |
| Configuración | `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `components.json` | Generados por `create-next-app`/`shadcn init`; `next.config.ts` añade `output: "standalone"`. |
| Entorno | `src/lib/env.ts` | Esquema Zod y carga de variables de entorno (`loadEnv`, `getEnv`). |
| Arranque | `instrumentation.ts` (raíz del proyecto) | Llama a `getEnv()` una vez por instancia del servidor; si falla, el proceso no arranca. |
| Prisma | `prisma/schema.prisma`, `prisma/seed.ts`, `src/server/db/client.ts` | Esquema base, seed placeholder, cliente Prisma singleton. |
| Servicio | `src/server/platform/health.service.ts` | Comprobación de base de datos y almacenamiento (`checkHealth`). |
| Entrada | `src/app/api/health/route.ts` | `GET` que llama al servicio y traduce el resultado a HTTP. |
| Interfaz | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` | Layout raíz y página de inicio mínima (placeholder de la demo). |
| CI/CD | `.github/workflows/tests.yml`, `.github/workflows/deploy.yml`, `docker-compose.yml`, `docker-compose.prod.yml`, `Dockerfile`, `.dockerignore` | Integración continua y despliegue. |
| Documentación | `.env.example`, `README.md` (raíz) | Variables de entorno de ejemplo y guía de arranque en menos de 15 minutos (RNF-PLT-04). |

## Contratos

### Endpoints

| Método | Ruta | Rol | Entrada | Respuestas |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | público (uso interno de monitorización, sin datos sensibles) | — | 200 `HealthCheckResult` (`status: "ok"`), 503 `HealthCheckResult` (`status: "error"`) |

### Funciones

```ts
// src/lib/env.ts
export const envSchema: z.ZodObject<{
  NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
  PORT: z.ZodDefault<z.ZodNumber>;
  DATABASE_URL: z.ZodString; // debe ser una URL postgresql://...
  S3_ENDPOINT: z.ZodString;  // URL, p. ej. http://localhost:9000
  S3_REGION: z.ZodDefault<z.ZodString>;
  S3_ACCESS_KEY: z.ZodString;
  S3_SECRET_KEY: z.ZodString;
  S3_BUCKET: z.ZodString;
  S3_FORCE_PATH_STYLE: z.ZodDefault<z.ZodBoolean>;
}>;

export type Env = z.infer<typeof envSchema>;

/** Valida `source` contra envSchema. Lanza Error con un mensaje que
 *  incluye el nombre y el motivo de cada variable inválida o ausente. */
export function loadEnv(source?: NodeJS.ProcessEnv): Env;

/** Devuelve el resultado cacheado de loadEnv(process.env); solo lo
 *  calcula la primera vez que se llama en el proceso. */
export function getEnv(): Env;
```

```ts
// instrumentation.ts
export function register(): void; // llama a getEnv(); deja que el error de loadEnv se propague y pare el arranque
```

```ts
// src/server/db/client.ts
export const prisma: PrismaClient; // singleton, reutiliza la instancia en `global` durante el hot-reload de `next dev`
```

```ts
// src/server/platform/health.service.ts
export type HealthStatus = "ok" | "error";
export type HealthCheckResult = {
  status: HealthStatus;
  checks: { database: HealthStatus; storage: HealthStatus };
};

/** Comprueba la base de datos (`SELECT 1` con Prisma) y el almacenamiento
 *  (fetch a S3_ENDPOINT con timeout de 2000 ms; cualquier respuesta HTTP,
 *  incluida un 403 de MinIO, cuenta como "ok"; un error de red cuenta
 *  como "error"). Las comprobaciones son inyectables para los tests. */
export async function checkHealth(
  checkDatabase?: () => Promise<boolean>,
  checkStorage?: () => Promise<boolean>,
): Promise<HealthCheckResult>;
```

```ts
// src/app/api/health/route.ts
export async function GET(): Promise<Response>;
// NextResponse.json(result, { status: result.status === "ok" ? 200 : 503 })
```

## Flujos

```mermaid
sequenceDiagram
  participant Next as Next.js (boot)
  participant Env as src/lib/env.ts
  participant Mon as Monitorización
  participant API as /api/health
  participant Health as health.service.ts
  participant DB as PostgreSQL
  participant S3 as MinIO

  Next->>Env: register() -> getEnv()
  Env-->>Next: Env válido (o Error que detiene el arranque)
  Mon->>API: GET /api/health
  API->>Health: checkHealth()
  Health->>DB: SELECT 1
  Health->>S3: fetch(S3_ENDPOINT)
  Health-->>API: HealthCheckResult
  API-->>Mon: 200 ok | 503 error
```

## Errores

| Error de dominio | HTTP | Mensaje en la interfaz |
| --- | --- | --- |
| Variable de entorno ausente o inválida (`loadEnv`) | — (el proceso no arranca) | Error de servidor en el log de arranque: `Variables de entorno inválidas: <campo>: <motivo>`. No es una respuesta HTTP porque ocurre antes de que el servidor acepte tráfico. |
| Base de datos o almacenamiento no disponibles (`checkHealth`) | 503 | No aplica interfaz: es un endpoint de monitorización, no se muestra al usuario final. |

## Seguridad y privacidad

- `/api/health` no requiere rol ni filtra por organización: no expone datos de negocio, solo un estado `ok`/`error` por dependencia.
- Ninguna variable de entorno ni su valor se registra en logs; `loadEnv` solo informa del **nombre** del campo inválido, nunca de su valor.
- `.env.example` no contiene secretos reales (placeholders tipo `changeme`).
- En producción, las credenciales de PostgreSQL y MinIO no son las de desarrollo: salen de los secrets del environment `ionosL1` (ver [Despliegue](#despliegue)). El `.env` generado en el servidor tiene permisos `600` y el paso que lo crea solo registra en el log los **nombres** de las variables sustituidas, nunca sus valores.
- Sin datos personales en este módulo: no hay entidades de negocio todavía.

## Despliegue

El despliegue lo hace `.github/workflows/deploy.yml` en el runner propio `ionos-l1-docker`, sobre un checkout persistente en `SOURCE_PATH`. El job declara `environment: ionosL1` para tener acceso a los secrets y variables de ese environment.

### Generación de `.env`

GitHub Actions no inyecta los secrets ni las variables como variables de entorno de los pasos: hay que referenciarlos. El paso "Generate .env from .env.example" (`actions/github-script`) recibe todos de una vez como JSON (`toJSON(secrets)` y `toJSON(vars)`) y:

1. Lee `.env.example` del checkout línea a línea.
2. Conserva comentarios y líneas en blanco tal cual.
3. Para cada línea `CLAVE=valor`, si `CLAVE` existe como secret se usa su valor; si no, como variable; si no existe en ninguno, se deja el valor de `.env.example`.
4. Escribe el resultado en `SOURCE_PATH/.env` con permisos `600`. Un valor con saltos de línea hace fallar el paso.

Decisiones:

- `.env.example` se **copia**, no se renombra: es un fichero versionado y, si se moviera, el siguiente `git pull` del checkout persistente fallaría o dejaría de encontrarlo.
- La lista de variables la define `.env.example`: un módulo que añade una variable nueva solo tiene que añadirla allí y crear el secret o la variable con el mismo nombre en `ionosL1`; `deploy.yml` no cambia.
- Los valores se escriben sin comillas (`CLAVE=valor`). Docker Compose interpola `$` en `.env`, así que los secrets no deben contener `$`.

Secrets obligatorios en `ionosL1`: `S3_ACCESS_KEY`, `S3_SECRET_KEY` (mínimo 8 caracteres, lo exige MinIO) y `POSTGRES_PASSWORD` (solo letras, números, `-` y `_`, porque va dentro de `DATABASE_URL`). Opcionales: `POSTGRES_USER`, `POSTGRES_DB`, `S3_BUCKET`, `S3_REGION`. `SOURCE_PATH` sigue siendo un secret propio del workflow.

### `docker-compose.prod.yml`

Se combina con `docker-compose.yml` (`-f docker-compose.yml -f docker-compose.prod.yml`) y Docker Compose lee el mismo `.env` para interpolar `${...}`, de modo que la app y cada servicio comparten credenciales:

| Servicio | Variables | Origen |
| --- | --- | --- |
| `app` | `NODE_ENV=production`, `S3_ENDPOINT=http://minio:9000`, `S3_FORCE_PATH_STYLE=true`, `DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}` | Fijadas en el fichero; pisan las de `.env` para que la app use siempre los nombres de servicio de la red interna de Docker, nunca `localhost`. El resto (`S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`) llega por `env_file: .env`. |
| `minio` | `MINIO_ROOT_USER=${S3_ACCESS_KEY}`, `MINIO_ROOT_PASSWORD=${S3_SECRET_KEY}` | `.env` |
| `postgres` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (por defecto `formia` salvo la contraseña); el healthcheck usa `$POSTGRES_USER` | `.env` |

- Solo `app` publica puerto (3000); PostgreSQL, MinIO y Mailpit quedan en la red interna (`ports: []`).
- `S3_ACCESS_KEY`, `S3_SECRET_KEY` y `POSTGRES_PASSWORD` usan `${VAR:?mensaje}`: si faltan, `docker-compose` falla antes de arrancar con un mensaje claro.
- PostgreSQL y MinIO solo aplican estas credenciales al inicializar un volumen vacío. Si `postgres-data` o `minio-data` ya existen con otras credenciales, hay que cambiarlas a mano o recrear el volumen (con pérdida de datos).
- El bucket `S3_BUCKET` no lo crea este módulo; lo hará el módulo que empiece a guardar archivos.
- Pendiente para ese módulo: las URLs firmadas de fotos y firmas las abre el navegador, que no puede llegar a `http://minio:9000`. Hará falta un endpoint público con HTTPS (proxy inverso hacia MinIO) y probablemente una variable aparte para él.

## Tests

| Criterio | Tipo | Fichero |
| --- | --- | --- |
| CA-PLT-01 | Playwright | `e2e/platform-smoke.spec.ts` — arranca la app con `npm run dev` (vía `webServer` de `playwright.config.ts`) y comprueba que `GET /` responde 200. |
| CA-PLT-02 | Verificación de configuración de CI, no test de repositorio | `.github/workflows/tests.yml` incluye el paso `npm run typecheck`; se verifica observando que la CI falla ante un error de tipos introducido deliberadamente en un PR de prueba (no se deja ese error en el código). |
| CA-PLT-03 | Vitest | `src/lib/env.test.ts` — `loadEnv({ ...válido, DATABASE_URL: undefined })` lanza `Error` cuyo mensaje incluye `DATABASE_URL`; con todas las variables presentes y válidas, `loadEnv` devuelve el objeto esperado. |
| CA-PLT-04 | Vitest | `src/server/platform/health.service.test.ts` — `checkHealth` con las dos comprobaciones en `true` devuelve `status: "ok"`; con cualquiera en `false` devuelve `status: "error"` y marca solo el campo correspondiente. |
| RF-PLT-08 (endpoint) | Vitest | `src/app/api/health/route.test.ts` — mockea `checkHealth` y comprueba que la respuesta tiene el código HTTP esperado (200/503) y el cuerpo JSON correcto. |

## Tareas de desarrollo

| Orden | Issue | Tarea | Depende de |
| --- | --- | --- | --- |
| 1 | #3 | Scaffolding: `create-next-app`, `shadcn init`, `prisma init`, dependencias (`zod`, `tsx`, `vitest`, `@playwright/test`), `package.json` con los scripts de CLAUDE.md | — |
| 2 | #3 | `src/lib/env.ts` + `src/lib/env.test.ts`, `.env.example`, `instrumentation.ts` | 1 |
| 3 | #3 | `docker-compose.yml` (Postgres, MinIO, Mailpit) | — |
| 4 | #3 | `src/server/db/client.ts`, `prisma/schema.prisma` (sin modelos), `prisma/seed.ts` placeholder | 1, 3 |
| 5 | #3 | `src/server/platform/health.service.ts` + test, `src/app/api/health/route.ts` + test | 2, 4 |
| 6 | #3 | `src/app/layout.tsx`, `src/app/page.tsx` (placeholder) | 1 |
| 7 | #3 | `Dockerfile`, `.dockerignore`, `docker-compose.prod.yml` (credenciales desde `.env`), adaptar `deploy.yml` (environment `ionosL1` y generación de `.env`) | 3 |
| 8 | #3 | Reescribir `tests.yml`; `playwright.config.ts`, `vitest.config.ts`, `e2e/platform-smoke.spec.ts` | 2, 4, 5, 6 |
| 9 | #3 | `README.md` raíz con la guía de arranque (RNF-PLT-04) | 1-8 |

## Historial de cambios

- 2026-11-14 — Diseño técnico inicial (#3): estructura del proyecto, validación de entorno, endpoint de salud, docker-compose de desarrollo y producción, y adaptación de la CI existente.
- 2026-11-15 — Correcciones del arquitecto (#3): separada la responsabilidad de `package.json` (`postinstall` y `"prisma": { "seed": ... }`) de `prisma.config.ts` (no se necesita en este módulo) en la sección "Modelo de datos", para que quede claro qué va en cada fichero.
- 2026-11-17 — Despliegue (#3): `deploy.yml` genera `.env` a partir de `.env.example` y de los secrets y variables del environment `ionosL1`; `docker-compose.prod.yml` toma de `.env` las credenciales de PostgreSQL y MinIO y fija los endpoints internos de la app; nuevas variables `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB` en `.env.example`. Nueva sección "Despliegue".
