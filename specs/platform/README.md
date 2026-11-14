# Plataforma base

- **Prefijo:** `PLT`
- **Estado:** borrador
- **Responsable:** analyst-programmer (escribe), architect (revisa)

## Objetivo

Proporcionar el esqueleto técnico sobre el que se construyen los demás módulos: proyecto Next.js con TypeScript, servicios locales con docker-compose, comandos estándar, integración continua y despliegue de la demo pública.

## Alcance

**Incluido**
- Proyecto Next.js (App Router) + TypeScript estricto + Tailwind + shadcn/ui + Prisma.
- `docker-compose.yml` con PostgreSQL, MinIO y Mailpit para desarrollo local.
- Imagen Docker de la aplicación para producción.
- Comandos de `package.json` listados en `CLAUDE.md`.
- `.env.example` completo y validación de variables de entorno al arrancar.
- CI en GitHub Actions: lint, typecheck, tests unitarios y e2e.
- Despliegue de la demo pública.

**Fuera de alcance**
- Multirregión, autoescalado, colas o microservicios.

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-PLT-01 | Must | `docker compose up -d` levanta PostgreSQL, MinIO y Mailpit sin pasos manuales. |
| RF-PLT-02 | Must | Existen los comandos `dev`, `lint`, `typecheck`, `test`, `test:e2e`, `db:migrate` y `db:seed`. |
| RF-PLT-03 | Must | La aplicación valida con Zod las variables de entorno al arrancar y falla con un mensaje claro si falta alguna. |
| RF-PLT-04 | Must | `.env.example` documenta todas las variables necesarias, sin valores secretos reales. |
| RF-PLT-05 | Must | La CI ejecuta lint, typecheck y tests en cada push y pull request. |
| RF-PLT-06 | Should | La CI ejecuta los tests e2e de la demo contra una base de datos de pruebas. |
| RF-PLT-07 | Must | Un push a `main` despliega la aplicación en el entorno de demo. |
| RF-PLT-08 | Should | Existe un endpoint `/api/health` que comprueba la base de datos y el almacenamiento. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-PLT-01 | Must | TypeScript en modo `strict`; el linter falla con `any` explícito. |
| RNF-PLT-02 | Must | Los secretos solo se leen de variables de entorno; nunca se suben al repositorio. |
| RNF-PLT-03 | Must | El entorno de demo se aloja en la UE. |
| RNF-PLT-04 | Should | Un desarrollador nuevo tiene la demo funcionando en local en menos de 15 minutos siguiendo el README raíz. |

## Dependencias

- Lo usan: todos los módulos.

## Criterios de aceptación

- **CA-PLT-01** — Dado un clon limpio del repositorio con `.env` copiado de `.env.example`, cuando se ejecutan `docker compose up -d`, `npm install`, `npm run db:migrate`, `npm run db:seed` y `npm run dev`, entonces la aplicación responde en `http://localhost:3000`.
- **CA-PLT-02** — Dado un push con un error de tipos, cuando corre la CI, entonces el trabajo falla.
- **CA-PLT-03** — Dada una variable obligatoria sin definir, cuando arranca la aplicación, entonces se detiene indicando el nombre de la variable.

## Supuestos y preguntas abiertas

- Los workflows actuales de `.github/workflows/` (`tests.yml`, `deploy.yml`) proceden de otro proyecto (rutas `ingest/`, `control/backend`) y deben adaptarse a este stack.
- Destino de la demo pública: `CLAUDE.md` indica Azure (contenedores); `deploy.yml` usa un runner propio (`ionos-l1-docker`) con docker-compose. Pendiente de decidir.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
