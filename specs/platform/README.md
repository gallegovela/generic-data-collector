# Plataforma base

- **Prefijo:** `PLT`
- **Estado:** diseñado
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #1 (análisis), #3 (diseño)

## Objetivo

Proporcionar el esqueleto técnico sobre el que se construyen los demás módulos: proyecto Next.js con TypeScript, servicios locales con docker-compose, comandos estándar, integración continua y despliegue de la demo pública.

## Alcance

**Incluido**
- Proyecto Next.js (App Router) + TypeScript estricto + Tailwind + shadcn/ui + Prisma, creado con las herramientas oficiales (`create-next-app`, `shadcn init`, `prisma init`).
- `docker-compose.yml` con PostgreSQL, MinIO y Mailpit para desarrollo local; `docker-compose.prod.yml` que añade el contenedor de la aplicación para el entorno de demo.
- Imagen Docker de la aplicación para producción (`Dockerfile` multi-stage, salida `standalone` de Next.js).
- Comandos de `package.json` listados en `CLAUDE.md`.
- Validación de variables de entorno con Zod al arrancar el servidor (`src/lib/env.ts`), ejecutada una vez por instancia mediante `instrumentation.ts`. Cada módulo añade a este esquema y a `.env.example` las variables que introduce (por ejemplo, autenticación en [tenancy-auth](../tenancy-auth/README.md)); en este módulo solo se cubren las variables que ya existen: base de datos y almacenamiento.
- `.env.example` con las variables de este módulo.
- CI en GitHub Actions (`tests.yml`): lint, typecheck y tests unitarios en cada push y pull request; tests e2e con Postgres de servicio.
- Despliegue de la demo pública (`deploy.yml`, ya existente, adaptado a `docker-compose.prod.yml`).
- Cliente de Prisma compartido (`src/server/db/client.ts`) y esquema base (`prisma/schema.prisma`) sin modelos de negocio: cada módulo añade los suyos en su propia migración.
- Endpoint `GET /api/health` que comprueba la conectividad con la base de datos y el almacenamiento.
- Página raíz mínima (`src/app/page.tsx`) para que la aplicación responda en `http://localhost:3000` (CA-PLT-01); el contenido real del panel llega con [form-editor](../form-editor/README.md) y [submissions-dashboard](../submissions-dashboard/README.md).

**Fuera de alcance**
- Multirregión, autoescalado, colas o microservicios.
- Variables de entorno, integraciones o modelos de datos de otros módulos (autenticación, IA, email, exportaciones): cada uno los añade cuando se diseñe.
- Despliegue en Azure: se mantiene el runner propio con `docker-compose` que ya usa el proyecto (ver "Supuestos y preguntas abiertas"); migrar a Azure queda fuera de este módulo.

## Actores

| Actor | Qué hace en este módulo |
| --- | --- |
| Desarrollador | Clona el repositorio, levanta los servicios locales y ejecuta los comandos estándar. |
| CI (GitHub Actions) | Comprueba lint, tipos y tests en cada cambio; despliega la demo al hacer push a `main`. |
| Monitorización | Consulta `/api/health` para saber si la aplicación, la base de datos y el almacenamiento están disponibles. |

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-PLT-01 | Must | `docker compose up -d` levanta PostgreSQL, MinIO y Mailpit sin pasos manuales, con datos persistentes entre reinicios (volúmenes nombrados). |
| RF-PLT-02 | Must | Existen los comandos `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `db:migrate` y `db:seed`. |
| RF-PLT-03 | Must | La aplicación valida con Zod las variables de entorno al arrancar y falla con un mensaje claro si falta alguna o tiene un formato inválido. |
| RF-PLT-04 | Must | `.env.example` documenta todas las variables necesarias de este módulo, sin valores secretos reales. |
| RF-PLT-05 | Must | La CI ejecuta lint, typecheck y tests unitarios en cada push y pull request. |
| RF-PLT-06 | Should | La CI ejecuta los tests e2e de la demo contra una base de datos de pruebas. |
| RF-PLT-07 | Must | Un push a `main` despliega la aplicación en el entorno de demo. |
| RF-PLT-08 | Should | Existe un endpoint `GET /api/health` que comprueba la base de datos y el almacenamiento y responde 200 u 503 según el resultado. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-PLT-01 | Must | TypeScript en modo `strict`; el linter falla con `any` explícito. |
| RNF-PLT-02 | Must | Los secretos solo se leen de variables de entorno; nunca se suben al repositorio. |
| RNF-PLT-03 | Must | El entorno de demo se aloja en la UE. |
| RNF-PLT-04 | Should | Un desarrollador nuevo tiene la demo funcionando en local en menos de 15 minutos siguiendo el README raíz. |

## Dependencias

- Depende de: ninguno.
- Lo usan: todos los módulos.

## Criterios de aceptación

- **CA-PLT-01** — Dado un clon limpio del repositorio con `.env` copiado de `.env.example`, cuando se ejecutan `docker compose up -d`, `npm install`, `npm run db:migrate`, `npm run db:seed` y `npm run dev`, entonces la aplicación responde en `http://localhost:3000`.
- **CA-PLT-02** — Dado un push con un error de tipos, cuando corre la CI, entonces el trabajo falla.
- **CA-PLT-03** — Dada una variable obligatoria sin definir, cuando arranca la aplicación, entonces se detiene indicando el nombre de la variable.
- **CA-PLT-04** — Dada la base de datos y el almacenamiento accesibles, cuando se consulta `GET /api/health`, entonces responde 200 con `{"status":"ok"}`; si alguno no está accesible, responde 503 indicando cuál.

## Supuestos y preguntas abiertas

- **Resuelto** — Los workflows actuales de `.github/workflows/` (`tests.yml`, `deploy.yml`) procedían de otro proyecto (rutas `ingest/`, `control/backend`); `tests.yml` se reescribe por completo para este stack (ver [design.md](design.md)) y `deploy.yml` se adapta para usar `docker-compose.prod.yml`, pero mantiene el mismo runner propio y la misma estrategia (checkout persistente + `docker-compose build`/`up`).
- **Pendiente de confirmar por el arquitecto** — Destino de la demo pública: `CLAUDE.md` indica Azure (contenedores) como objetivo, pero la infraestructura ya existente (`deploy.yml`) usa un runner propio (`ionos-l1-docker`) con `docker-compose`. Propuesta de este módulo: mantener el runner propio para el piloto (reutiliza lo que ya existe, coste cero, sin nueva infraestructura que aprender) y dejar la migración a Azure como trabajo futuro fuera del piloto, documentado aquí. Ver pregunta 1 en el issue #3.
- **Pendiente de confirmar por el arquitecto** — RNF-PLT-03 exige alojamiento en la UE; se asume que el runner `ionos-l1-docker` (IONOS) está en un centro de datos de la UE, pero el módulo `platform` no puede verificarlo por sí mismo. Ver pregunta 2 en el issue #3.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
- 2026-11-14 — Alcance y requisitos revisados para el diseño técnico: comandos `build`/`start`, volúmenes persistentes, `.env.example` acotado a las variables de este módulo, nuevo CA-PLT-04 para el endpoint de salud, y resolución parcial de las preguntas abiertas (#3).
