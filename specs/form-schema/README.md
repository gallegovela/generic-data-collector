# Esquema del formulario

- **Prefijo:** `FSC`
- **Estado:** borrador
- **Responsable:** analyst-programmer (escribe), architect (revisa)

## Objetivo

Definir, una sola vez y con Zod, el JSON versionado que describe un formulario (campos, orden, lógica condicional y tema aplicado). Es el contrato central: lo usan el editor, el asistente de IA, el renderizador del móvil, el PDF, las exportaciones y la API.

## Alcance

**Incluido**
- Esquema Zod en `src/lib/form-schema`, con tipos TypeScript derivados.
- Tipos de campo del piloto y sus opciones.
- Lógica condicional básica (mostrar u ocultar).
- Validación de una respuesta contra el esquema.
- Versión del propio formato (`schemaVersion`) y migraciones entre versiones del formato.

**Fuera de alcance**
- Cálculos entre campos, repeticiones (grupos repetibles), lógica con varias condiciones combinadas complejas.

## Tipos de campo

| Tipo | Valor de la respuesta | Opciones principales |
| --- | --- | --- |
| `text` | `string` | `multiline`, `minLength`, `maxLength`, `placeholder` |
| `number` | `number` | `min`, `max`, `decimals`, `unit` |
| `date` | `string` ISO fecha | `min`, `max` |
| `datetime` | `string` ISO fecha y hora | `min`, `max` |
| `time` | `string` `HH:mm` | — |
| `single_choice` | `string` (id de opción) | `options[]`, `display: radio \| dropdown` |
| `multiple_choice` | `string[]` | `options[]`, `minSelected`, `maxSelected` |
| `yes_no` | `boolean` | — |
| `photo` | `FileRef[]` | `maxPhotos`, `allowGallery` |
| `signature` | `FileRef` | — |
| `gps` | `{ lat, lng, accuracy, capturedAt }` | `autoCapture` |
| `section` | (sin valor) | `title`, `description` |

Todo campo tiene: `id` estable, `type`, `label`, `description?`, `required`, `visibleIf?`.

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-FSC-01 | Must | El esquema se define con Zod en un único sitio y se reutiliza en cliente y servidor. |
| RF-FSC-02 | Must | El esquema incluye `schemaVersion`, metadatos (`title`, `description`), lista ordenada de campos y referencia al tema. |
| RF-FSC-03 | Must | Se admiten los tipos de campo de la tabla anterior con sus opciones. |
| RF-FSC-04 | Must | Cada campo tiene un `id` estable que no cambia al reordenar ni al renombrar la etiqueta. |
| RF-FSC-05 | Must | Un campo puede mostrarse u ocultarse según el valor de otro campo anterior (`equals`, `notEquals`, `includes`, `isAnswered`). |
| RF-FSC-06 | Must | Existe una función que valida una respuesta completa contra el esquema, ignorando los campos ocultos por la lógica condicional. |
| RF-FSC-07 | Must | El esquema rechaza referencias condicionales a campos inexistentes, posteriores o circulares, e ids duplicados. |
| RF-FSC-08 | Should | Existen migraciones del formato para leer esquemas guardados con un `schemaVersion` anterior. |
| RF-FSC-09 | Should | Se exporta un JSON Schema equivalente para usarlo como formato de salida de la IA. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-FSC-01 | Must | El módulo no depende de ningún otro módulo ni hace E/S. |
| RNF-FSC-02 | Must | Cobertura de tests de al menos el 90 % de líneas; todo cambio del esquema va con tests (regla de `CLAUDE.md`). |

## Datos

- No posee tablas: define el contenido JSONB de `FormVersion.schema` y la forma de `Submission.answers`.

## Dependencias

- Lo usan: form-editor, ai-assistant, field-collector, form-publishing, submissions-dashboard, outputs, public-api, demo-seed.

## Criterios de aceptación

- **CA-FSC-01** — Dado un esquema con dos campos con el mismo `id`, cuando se valida, entonces falla con un error que nombra el `id` duplicado.
- **CA-FSC-02** — Dado un campo obligatorio oculto por la lógica condicional, cuando se valida una respuesta sin él, entonces la respuesta es válida.
- **CA-FSC-03** — Dado un campo `number` con `max: 10`, cuando la respuesta trae `11`, entonces la validación falla en ese campo.
- **CA-FSC-04** — Dados los tres formularios del seed, cuando se validan, entonces son válidos.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
