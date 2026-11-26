# Publicación y versiones

- **Prefijo:** `PUB`
- **Estado:** requisitos listos
- **Responsable:** analyst-programmer (escribe), architect (revisa)

## Objetivo

Convertir un borrador en un formulario utilizable, con versiones inmutables, y darle al administrador un enlace y un código QR para repartirlo. Cada formulario se configura como de acceso solo para usuarios registrados o como público con enlace.

## Alcance

**Incluido**
- Estados `draft` y `published` del formulario; solo un formulario publicado se puede rellenar.
- `FormVersion` inmutable por cada publicación.
- Modo de acceso por formulario (`registered` o `public`).
- Enlace estable con identificador corto no adivinable y código QR descargable.
- Despublicar (cerrar) un formulario.
- Contrato de lectura para quien rellena el formulario: formulario publicado por `slug` y versión por id, con el control de acceso por modo.
- Componente de interfaz para publicar, elegir el modo de acceso, copiar el enlace, ver y descargar el QR y despublicar.

**Fuera de alcance**
- Programar fechas de apertura o cierre, límites de respuestas.
- La pantalla de relleno, la recepción de respuestas y la limitación de tasa o protección anti-spam de la recepción pública (`field-collector`).
- Migrar o invalidar respuestas ya registradas: nunca se tocan (ver "Reglas").

## Reglas

- Las respuestas **nunca se migran ni se invalidan** cuando el formulario cambia. Cada respuesta se valida y se muestra con la versión con la que se recogió: si la v2 añade un campo obligatorio, las respuestas de v1 siguen siendo válidas bajo v1.
- Una respuesta en cola de una versión anterior se valida contra **esa** versión (siempre que sea del mismo formulario), no contra la última.
- El modo de acceso por defecto es `registered` (la opción segura).
- **Deuda (tema):** `FormVersionSchema.theme` es opcional y este módulo no lo guarda, así que la apariencia de una versión no queda congelada (se sirve `DEFAULT_THEME`). Cuando se diseñe `theming`, decidirá si cada publicación guarda `theme` en la versión. No bloquea esta pieza.

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-PUB-01 | Must | Al publicar se crea una `FormVersion` con una copia inmutable del esquema y el número de versión incrementado. |
| RF-PUB-02 | Must | Editar un formulario publicado modifica su borrador; los cambios no llegan a los trabajadores hasta volver a publicar. |
| RF-PUB-03 | Must | Cada respuesta apunta a la `FormVersion` con la que se rellenó. Este módulo lo cubre en el modelo y en el contrato de lectura (versión por id); el campo en `Submission` lo añade `submissions-dashboard`. |
| RF-PUB-04 | Must | El formulario publicado tiene un enlace estable `/f/<slug>` que siempre sirve la última versión publicada. |
| RF-PUB-05 | Must | Se genera un código QR del enlace, descargable en PNG y SVG. |
| RF-PUB-06 | Must | Un administrador puede despublicar un formulario; el enlace muestra entonces "Este formulario ya no acepta respuestas". |
| RF-PUB-07 | Should | Antes de publicar se muestra un resumen de cambios respecto a la versión anterior (campos añadidos, eliminados, modificados). **Aplazado a una segunda iteración** (decisión del arquitecto en #23/#26). |
| RF-PUB-08 | Must | Las respuestas en cola de una versión anterior se siguen aceptando tras republicar: el contrato permite obtener cualquier versión del formulario por id. |
| RF-PUB-09 | Must | Cada formulario tiene un modo de acceso `registered` (solo usuarios autenticados de su organización, admin o collector) o `public` (cualquiera con el enlace). Se elige al publicar, por defecto es `registered`, y se puede cambiar después sin crear una versión nueva. |
| RF-PUB-10 | Must | Un formulario solo es rellenable si está publicado; despublicado (o archivado), el enlace informa de que ya no acepta respuestas. |
| RF-PUB-11 | Must | Solo se puede publicar un borrador que cumpla el esquema de una versión (`FormVersionSchema`, al menos 1 campo); si no, la publicación se rechaza señalando los problemas. |

## Requisitos no funcionales

| ID | Requisito |
| --- | --- |
| RNF-PUB-01 | El `slug` es corto (10 caracteres), generado con un generador criptográfico (≈ 50 bits) y no se puede deducir del nombre ni del id del formulario. |
| RNF-PUB-02 | Toda operación de administración (publicar, despublicar, cambiar el modo, QR) filtra por `organizationId`; un formulario de otra organización responde 404. La lectura pública solo usa el `slug` y devuelve lo mínimo necesario para rellenar. |
| RNF-PUB-03 | La migración es compatible con los formularios ya creados: siguen en `draft`, sin `slug`, con modo `registered`. |

## Datos

- Posee: `FormVersion` y, del modelo `Form` de `form-editor`, las columnas `slug`, `accessMode` y `publishedVersion` (y el valor `published` de `status`).

## Dependencias

- Depende de: form-schema, form-editor, tenancy-auth.
- Lo usan: field-collector, submissions-dashboard, outputs.

## Criterios de aceptación

- **CA-PUB-01** — Dado un formulario publicado en v1, cuando se cambia una etiqueta y se publica, entonces existe v2 y las respuestas antiguas siguen mostrando las etiquetas de v1.
- **CA-PUB-02** — Dado un formulario publicado, cuando se escanea su QR con un móvil, entonces se abre el formulario.
- **CA-PUB-03** — Dado un formulario con respuestas en v1, cuando se publica una v2 con un campo obligatorio nuevo, entonces las respuestas de v1 se siguen mostrando íntegras con su esquema v1.
- **CA-PUB-04** — Dado un formulario en modo `registered`, cuando alguien sin sesión pide su definición para rellenarlo, entonces recibe un requerimiento de inicio de sesión; en modo `public` la obtiene.
- **CA-PUB-05** — Dado un formulario de la organización A, cuando un administrador de B intenta publicarlo o cambiarlo, entonces recibe 404.
- **CA-PUB-06** — Dado un formulario publicado, cuando el administrador lo despublica, entonces su enlace deja de servir la definición y muestra "Este formulario ya no acepta respuestas"; al volver a publicarlo, el mismo enlace vuelve a funcionar con una versión nueva.
- **CA-PUB-07** — Dado un borrador sin campos, cuando el administrador intenta publicarlo, entonces se rechaza con un mensaje claro y no se crea ninguna versión.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
- 2026-11-26 — Issue #26 (padre #23): nuevo modo de acceso (RF-PUB-09), regla de rellenado solo si está publicado (RF-PUB-10), publicación solo de borradores válidos (RF-PUB-11), RNF-PUB-01 a 03, CA-PUB-03 a 07; sección "Reglas" (las respuestas nunca se migran); RF-PUB-03 y RF-PUB-08 precisados; RF-PUB-07 aplazado; estado a "requisitos listos".
- 2026-11-26 — Issue #26, revisión del arquitecto: nota de deuda sobre el tema en "Reglas".
