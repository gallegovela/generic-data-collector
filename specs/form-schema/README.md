# Esquema del formulario

- **Prefijo:** `FSC`
- **Estado:** diseñado
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #1 (análisis), #5 (diseño)

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

Todo campo tiene: `id` estable, `type`, `label`, `description?`, `required`, `visibleIf?`. Las opciones propias de cada tipo (`multiline`, `min`, `options[]`…) se agrupan en una propiedad `config` del campo, para no confundirlas con `options[]` (la lista de opciones elegibles de `single_choice`/`multiple_choice`); ver [design.md](design.md#contratos).

El campo `section` no añade ninguna propiedad propia: su `label` hace de título y su `description` de texto explicativo, los dos ya comunes a todo campo; `required` queda fijado a `false` porque no tiene respuesta.

## Actores

| Actor | Qué hace en este módulo |
| --- | --- |
| form-editor | Construye y valida un `FormVersion` mientras el administrador edita el formulario. |
| ai-assistant | Genera un borrador de `FormVersion` y lo valida con este esquema antes de mostrarlo. |
| field-collector | Renderiza los campos visibles y valida las respuestas con `validateSubmission` antes de guardarlas (en línea o en Dexie). |
| form-publishing | Congela un `FormVersion` válido como versión publicada e inmutable. |
| submissions-dashboard / outputs / public-api | Leen `FormVersion` y `Submission.answers` ya validados para mostrarlos, exportarlos o servirlos. |

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
| RF-FSC-10 | Must | Cada opción de `single_choice`/`multiple_choice` tiene un `id` estable, independiente de su `label`, por el mismo motivo que RF-FSC-04 para los campos. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-FSC-01 | Must | El módulo no depende de ningún otro módulo ni hace E/S. |
| RNF-FSC-02 | Must | Cobertura de tests de al menos el 90 % de líneas; todo cambio del esquema va con tests (regla de `CLAUDE.md`). |

## Flujos principales

No aplica: `form-schema` no tiene flujos de usuario propios, es una librería pura sin interfaz. Los dos únicos flujos relevantes (validar un `FormVersion` al guardarlo y validar una `Submission` al enviarla) están documentados como diagramas de secuencia en [design.md](design.md#flujos).

## Datos

- No posee tablas: define el contenido JSONB de `FormVersion.schema` y la forma de `Submission.answers`.

## Dependencias

- Lo usan: form-editor, ai-assistant, field-collector, form-publishing, submissions-dashboard, outputs, public-api, demo-seed.

## Criterios de aceptación

- **CA-FSC-01** — Dado un esquema con dos campos con el mismo `id`, cuando se valida, entonces falla con un error que nombra el `id` duplicado.
- **CA-FSC-02** — Dado un campo obligatorio oculto por la lógica condicional, cuando se valida una respuesta sin él, entonces la respuesta es válida.
- **CA-FSC-03** — Dado un campo `number` con `max: 10`, cuando la respuesta trae `11`, entonces la validación falla en ese campo.
- **CA-FSC-04** — Dados los tres formularios del seed, cuando se validan, entonces son válidos.
- **CA-FSC-05** — Dado un `visibleIf` que referencia un campo inexistente, posterior en el orden o a sí mismo, cuando se valida el `FormVersion`, entonces falla indicando el `id` del campo problemático.
- **CA-FSC-06** — Dado un campo `multiple_choice` respondido con una opción marcada, cuando otro campo tiene `visibleIf: { operator: "includes", value: <esa opción> }`, entonces ese campo se considera visible; si la opción no está marcada, se considera oculto.
- **CA-FSC-07** — Dado un campo sin responder, cuando otro campo tiene `visibleIf: { operator: "isAnswered" }` sobre él, entonces se considera oculto; en cuanto se responde (con un valor no vacío), se considera visible.
- **CA-FSC-08** — Dada una respuesta antigua que apunta al `id` de una opción de `single_choice`, cuando se cambia el `label` de esa opción sin cambiar su `id`, entonces la respuesta sigue siendo válida.

## Supuestos y preguntas abiertas

- **Fixtures en lugar del seed real** — `demo-seed` todavía no existe (sin issue ni módulo diseñado): CA-FSC-04 se verifica con tres `FormVersion` de muestra definidos como *fixtures* dentro de este módulo (`src/lib/form-schema/fixtures/`), que representan el parte de obra, la encuesta de satisfacción y el alta de cliente de `CLAUDE.md`. Cuando se diseñe `demo-seed`, debería reutilizar estos fixtures en vez de redefinir los formularios.
- **Referencia al tema (RF-FSC-02)** — `theming` todavía no tiene issue. Para no incumplir RNF-FSC-01 (ninguna dependencia de otro módulo), `FormVersion.theme` es un `ThemeSnapshotSchema` mínimo (colores, tipografía, referencia al logo) definido dentro de este propio módulo. Cuando se diseñe `theming`, su analista decidirá si esta forma le vale tal cual o si hay que ampliarla (sería un cambio de contrato entre módulos, a avisar en ese issue).
- **Referencias a ficheros (`photo`, `signature`)** — `FileRef` guarda solo la referencia de almacenamiento (`key` y metadatos), nunca una URL firmada (que es de corta duración, ver RGPD en `CLAUDE.md`). `file-storage`, cuando se diseñe, deberá producir y consumir objetos con esta misma forma.
- **Cobertura de tests (RNF-FSC-02)** — Se automatiza con `@vitest/coverage-v8` y un umbral del 90 % en `vitest.config.ts` limitado a `include: ["src/lib/form-schema/**"]` (decidido con el arquitecto en el issue #5; ver `design.md#cobertura-rnf-fsc-02`). Cuando otro módulo necesite medir su propia cobertura, su analista tendrá que ampliar ese `include` o pasar a una configuración por módulo: queda anotado aquí como riesgo a revisar en ese momento.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
- 2026-11-17 — Diseño técnico (#5): esquema Zod completo (tipos de campo, lógica condicional, validación de respuestas); añadidas las secciones "Actores", "Flujos principales" y "Supuestos y preguntas abiertas"; añadido RF-FSC-10 (id estable de opción) y CA-FSC-05 a CA-FSC-08 (referencias de condición inválidas, operadores de visibilidad, estabilidad de id de opción), no enumerados explícitamente en el issue pero necesarios para cubrir RF-FSC-05 y RF-FSC-07 por completo; aclarado que `config` agrupa las opciones propias de cada tipo de campo y que `section` reutiliza `label`/`description`.
- 2026-11-17 — Revisión del arquitecto aplicada (#5): la cobertura de RNF-FSC-02 se automatiza con `@vitest/coverage-v8` en vez de quedar como comprobación manual.
