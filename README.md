# FormIA

Plataforma SaaS para crear formularios de recogida de datos (partes de obra,
inspecciones, pedidos en ruta, encuestas, altas de cliente...), pensada para
pymes y autónomos. Ver [`CLAUDE.md`](CLAUDE.md) para el contexto completo del
proyecto y [`specs/`](specs/) para la especificación funcional y técnica de
cada módulo.

## Arranque en local (menos de 15 minutos)

Requisitos: Node.js 22, npm y Docker con el plugin `docker compose` (v2).

```bash
git clone <url-del-repositorio>
cd generic-data-collector

cp .env.example .env            # ajusta los valores si lo necesitas

docker compose up -d            # PostgreSQL, MinIO y Mailpit (según COMPOSE_PROFILES)

npm install                     # también genera el cliente de Prisma
npm run db:migrate               # aplica las migraciones (ninguna todavía)
npm run db:seed                   # datos de ejemplo para la demo

npm run dev                       # http://localhost:3000
```

El endpoint `GET /api/health` indica si la base de datos y el almacenamiento
están accesibles (200 `ok` / 503 `error`).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (Turbopack). |
| `npm run build` | Build de producción (salida `standalone`). |
| `npm run start` | Sirve el build de producción. |
| `npm run lint` | Linter (ESLint). |
| `npm run typecheck` | Comprobación de tipos (`tsc --noEmit`). |
| `npm test` | Tests unitarios (Vitest). |
| `npm run test:e2e` | Tests de extremo a extremo (Playwright). |
| `npm run db:migrate` | Aplica las migraciones de Prisma (`prisma migrate deploy`). |
| `npm run db:seed` | Carga los datos de ejemplo de la demo (`prisma db seed`). |

Durante el desarrollo de un módulo con modelos nuevos, usa
`npx prisma migrate dev --name <nombre>` para crear la migración.

## Despliegue

El despliegue de la demo pública se hace siempre con `docker compose` (plugin
v2) en el servidor donde corre el GitHub Runner propio (`ionos-l1-docker`), a
través de `.github/workflows/deploy.yml`. Ese workflow invoca el binario
`docker-compose` (v1, con guion) porque es el que ya tiene instalado el
runner; si el runner migra al plugin v2, conviene unificar la sintaxis a
`docker compose`. No se usa Azure en ningún punto de este proyecto.

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

PostgreSQL y MinIO se pueden desactivar para usar los servicios que ya corren
en el servidor. Se controla en `.env` (o en las variables del environment
`ionosL1`, de donde `deploy.yml` genera `.env`):

| Variable | Servicios propios (por defecto) | Servicios externos del servidor |
| --- | --- | --- |
| `COMPOSE_PROFILES` | `postgres,minio` | `none` (o solo `postgres` / `minio`) |
| `POSTGRES_HOST`, `POSTGRES_PORT` | `formia-postgres`, `5432` | p. ej. `shared-postgres`, `5432` |
| `S3_DOCKER_ENDPOINT` | `http://minio:9000` | p. ej. `http://shared-garage:3900` |
| `SHARED_NETWORK` | `gallegovela-shared` | red Docker de los servicios externos |
| `APP_PORT` | `3000` | puerto del host para la app (solo en `127.0.0.1`, detrás de nginx) |

La app se une siempre a la red `SHARED_NETWORK`, así que esa red tiene que
existir. `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `S3_ACCESS_KEY`,
`S3_SECRET_KEY`, `S3_BUCKET` y `S3_REGION` tienen que ser los de los servicios
externos cuando se usan.

## Estructura

- `src/app/` — rutas de Next.js (App Router).
- `src/lib/` — lógica de negocio sin estado de servidor (p. ej. validación de
  variables de entorno).
- `src/server/` — acceso a datos y servicios de servidor (Prisma, salud).
- `prisma/` — esquema y seed de la base de datos.
- `e2e/` — tests de Playwright.
- `specs/` — especificación funcional y técnica por módulo (fuente de verdad).
