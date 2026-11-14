# Publicación y versiones

- **Prefijo:** `PUB`
- **Estado:** borrador
- **Responsable:** analyst-programmer (escribe), architect (revisa)

## Objetivo

Convertir un borrador en un formulario utilizable, con versiones inmutables, y darle al administrador un enlace y un código QR para repartirlo.

## Alcance

**Incluido**
- Estados `draft` y `published` del formulario.
- `FormVersion` inmutable por cada publicación.
- Enlace público con identificador corto y código QR descargable.
- Despublicar (cerrar) un formulario.

**Fuera de alcance**
- Programar fechas de apertura o cierre, límites de respuestas.

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-PUB-01 | Must | Al publicar se crea una `FormVersion` con una copia inmutable del esquema y el número de versión incrementado. |
| RF-PUB-02 | Must | Editar un formulario publicado modifica su borrador; los cambios no llegan a los trabajadores hasta volver a publicar. |
| RF-PUB-03 | Must | Cada respuesta apunta a la `FormVersion` con la que se rellenó. |
| RF-PUB-04 | Must | El formulario publicado tiene un enlace estable `/f/<slug>` que siempre sirve la última versión publicada. |
| RF-PUB-05 | Must | Se genera un código QR del enlace, descargable en PNG y SVG. |
| RF-PUB-06 | Must | Un administrador puede despublicar un formulario; el enlace muestra entonces "Este formulario ya no acepta respuestas". |
| RF-PUB-07 | Should | Antes de publicar se muestra un resumen de cambios respecto a la versión anterior (campos añadidos, eliminados, modificados). |
| RF-PUB-08 | Must | Las respuestas en cola de una versión anterior se siguen aceptando tras republicar. |

## Datos

- Posee: `Form` (estado, versión publicada actual, slug) y `FormVersion`.

## Dependencias

- Depende de: form-schema, form-editor, tenancy-auth.
- Lo usan: field-collector, submissions-dashboard, outputs.

## Criterios de aceptación

- **CA-PUB-01** — Dado un formulario publicado en v1, cuando se cambia una etiqueta y se publica, entonces existe v2 y las respuestas antiguas siguen mostrando las etiquetas de v1.
- **CA-PUB-02** — Dado un formulario publicado, cuando se escanea su QR con un móvil, entonces se abre el formulario.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
