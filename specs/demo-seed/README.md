# Datos y recorrido de la demo

- **Prefijo:** `SEED`
- **Estado:** borrador
- **Dueño de los requisitos:** architect

## Objetivo

Que la demo se pueda enseñar en cualquier momento con datos creíbles y que un test automático garantice que el recorrido completo funciona.

## Alcance

**Incluido**
- `npm run db:seed` con una organización de ejemplo, usuarios, tres formularios y respuestas.
- Test de Playwright del recorrido de la demo de `CLAUDE.md`, incluido el modo sin conexión.
- Guion breve de la demo.

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-SEED-01 | Must | El seed crea una organización de ejemplo con logo, colores y tipografía. |
| RF-SEED-02 | Must | El seed crea un usuario `admin` y un usuario `collector` con credenciales documentadas en el README raíz. |
| RF-SEED-03 | Must | El seed crea y publica tres formularios: parte diario de obra (fotos, firma, GPS), encuesta de satisfacción de cliente y alta de cliente para gestoría (datos personales y documentos). |
| RF-SEED-04 | Must | El seed crea al menos 15 respuestas de ejemplo repartidas en los últimos 30 días, con fotos y firmas de muestra. |
| RF-SEED-05 | Must | El seed se puede ejecutar varias veces sin duplicar datos (idempotente). |
| RF-SEED-06 | Must | Un test de Playwright recorre los cinco pasos de la demo: crear con IA (con la IA simulada), ajustar en el editor, publicar, rellenar en móvil sin conexión y ver la respuesta en el panel con email y Excel. |
| RF-SEED-07 | Should | Existe `specs/demo-seed/demo-script.md` con el guion de la demo en 10 minutos. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-SEED-01 | Must | Los datos de ejemplo son ficticios; ningún dato personal real. |
| RNF-SEED-02 | Must | El test e2e de la demo no llama a la API real de IA (usa una respuesta grabada). |

## Dependencias

- Depende de: todos los módulos funcionales.

## Criterios de aceptación

- **CA-SEED-01** — Dada una base de datos vacía, cuando se ejecuta `npm run db:seed` dos veces, entonces hay exactamente una organización de ejemplo y tres formularios.
- **CA-SEED-02** — Dado el entorno local levantado, cuando se ejecuta `npm run test:e2e`, entonces el recorrido de la demo pasa.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
