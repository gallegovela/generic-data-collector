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
- Azure: no se usa para nada en este piloto. El despliegue de todo el proyecto se hace con `docker-compose` en el servidor donde corre el GitHub Runner propio (`ionos-l1-docker`), confirmado por el responsable de producto en el issue #3.

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
| RNF-PLT-05 | Must | Todo error no capturado en el servidor (route handlers, server components y server actions) deja una línea JSON en la salida de errores del proceso (`docker logs`) con la hora, el método, la plantilla de la ruta (`/invite/[token]`, nunca la URL real), el tipo de ruta, el nombre y el código del error, el `digest` que ve el usuario y las líneas de la pila. No incluye el mensaje del error, la query string, cabeceras, cuerpos ni datos de las respuestas (RGPD). |

## Flujos principales

No aplica: `platform` es un módulo de infraestructura sin flujos de usuario propios. El único flujo relevante es el de arranque/monitorización, ya documentado como diagrama de secuencia en [design.md](design.md#flujos).

## Datos

No aplica: `platform` no define entidades de negocio propias. `prisma/schema.prisma` solo contiene los bloques `datasource`/`generator`; las primeras entidades (`Organization`, `User`) las añade [tenancy-auth](../tenancy-auth/README.md).

## Dependencias

- Depende de: ninguno.
- Lo usan: todos los módulos.

## Criterios de aceptación

- **CA-PLT-01** — Dado un clon limpio del repositorio con `.env` copiado de `.env.example`, cuando se ejecutan `docker compose up -d`, `npm install`, `npm run db:migrate`, `npm run db:seed` y `npm run dev`, entonces la aplicación responde en `http://localhost:3000`.
- **CA-PLT-02** — Dado un push con un error de tipos, cuando corre la CI, entonces el trabajo falla.
- **CA-PLT-03** — Dada una variable obligatoria sin definir, cuando arranca la aplicación, entonces se detiene indicando el nombre de la variable.
- **CA-PLT-04** — Dada la base de datos y el almacenamiento accesibles, cuando se consulta `GET /api/health`, entonces responde 200 con un cuerpo `HealthCheckResult` cuyo campo `status` es `"ok"` (entre otros campos, ver `checks` en [design.md](design.md#contratos)); si alguno no está accesible, responde 503 con `status: "error"` indicando en `checks` cuál ha fallado.
- **CA-PLT-05** — Dado un error no capturado en una petición a `/invite/abc123?x=1`, cuando el servidor lo procesa, entonces escribe en la salida de errores una línea JSON con `event: "request_error"`, `route: "/invite/[token]"`, el `name` y el `digest` del error, y la línea no contiene ni el mensaje del error, ni `abc123`, ni la query string.

## Supuestos y preguntas abiertas

- **Resuelto** — Los workflows actuales de `.github/workflows/` (`tests.yml`, `deploy.yml`) procedían de otro proyecto (rutas `ingest/`, `control/backend`); `tests.yml` se reescribe por completo para este stack (ver [design.md](design.md)) y `deploy.yml` se adapta para usar `docker-compose.prod.yml`, pero mantiene el mismo runner propio y la misma estrategia (checkout persistente + `docker-compose build`/`up`).
- **Resuelto** — Destino de la demo pública: el responsable de producto confirma en el issue #3 que no se usa Azure en ningún punto de este piloto; el despliegue de todo el proyecto se hace con `docker-compose` en el servidor donde corre el GitHub Runner propio (`ionos-l1-docker`). `CLAUDE.md` queda desactualizado en este punto; se debe corregir en un cambio aparte (fuera del alcance de `platform`, lo apunta el arquitecto).
- **Resuelto** — RNF-PLT-03 exige alojamiento en la UE; el responsable de producto confirma en el issue #3 que el servidor donde corre el runner está alojado en la Unión Europea y sujeto a su legislación de protección de datos.
- **Mejora futura, no bloquea el piloto** — `GET /api/health` no requiere rol y puede quedar expuesto públicamente; hoy solo filtra `ok`/`error` por dependencia (poca información). Si en el futuro se añaden más detalles (versión, latencias), conviene protegerlo o limitarlo a red interna. Apuntado por el arquitecto en la revisión del issue #3.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
- 2026-11-14 — Alcance y requisitos revisados para el diseño técnico: comandos `build`/`start`, volúmenes persistentes, `.env.example` acotado a las variables de este módulo, nuevo CA-PLT-04 para el endpoint de salud, y resolución parcial de las preguntas abiertas (#3).
- 2026-11-15 — Aplicadas las correcciones del arquitecto (#3): se resuelve sin ambigüedad que no se usa Azure (confirmado por el responsable de producto) y que el servidor del runner está en la UE; se añaden las secciones "Flujos principales" y "Datos" (ambas "no aplica", explícitas); se amplía el texto de CA-PLT-04 para que cubra el cuerpo completo de `HealthCheckResult`.
- 2026-11-24 — Nuevo RNF-PLT-05 y CA-PLT-05: registro mínimo de errores del servidor, sin datos personales, para poder diagnosticar fallos en `docker logs`.
