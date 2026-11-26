# Salidas de datos

- **Prefijo:** `OUT`
- **Estado:** borrador
- **Responsable:** analyst-programmer (escribe), architect (revisa)

## Objetivo

Llevar las respuestas a donde el cliente las necesita: un email con PDF, Excel o CSV para su gestor, o un webhook hacia sus propios sistemas.

## Alcance

**Incluido**
- `Destination` por formulario: email y webhook.
- Generación del PDF de una respuesta en el servidor.
- Exportación a Excel (exceljs) y CSV.
- Envío de webhooks firmados con reintentos.

**Fuera de alcance**
- Integraciones concretas con ERP o contabilidad, Google Sheets, salidas programadas.

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-OUT-01 | Must | Un administrador puede configurar en un formulario uno o varios destinatarios de email. |
| RF-OUT-02 | Must | Cada respuesta nueva envía a esos destinatarios un email con el PDF de la respuesta adjunto. |
| RF-OUT-03 | Must | El PDF incluye logo y colores de la organización, nombre del formulario, versión, fechas, todas las respuestas visibles, fotos, firma y coordenadas GPS. |
| RF-OUT-04 | Must | El administrador puede descargar el PDF de cualquier respuesta desde su ficha. |
| RF-OUT-05 | Must | El administrador puede exportar las respuestas de un formulario, con los filtros activos, a Excel (.xlsx) y CSV. |
| RF-OUT-06 | Must | En la exportación, cada campo es una columna, identificado por su `id` estable y con su etiqueta como cabecera. Si las respuestas exportadas proceden de varias versiones del formulario, hay una columna por cada campo de la unión de versiones (con la etiqueta de la versión más reciente en que aparece), la celda queda vacía donde la versión de la respuesta no tenía ese campo y se añade una columna con el número de versión. Las fotos y firmas se exportan como enlace a la ruta autenticada de la aplicación para ese archivo (requiere sesión de la organización), nunca como URL firmada de larga duración (RF-STO-02). |
| RF-OUT-11 | Must | La exportación solo la puede pedir un administrador, solo de formularios de su organización (si no, 404), y exporta exactamente las respuestas que el listado muestra con los mismos filtros (sin paginar). |
| RF-OUT-12 | Must | Ninguna celda de la exportación se interpreta como fórmula: los textos que empiezan por `=`, `+`, `-` o `@` se neutralizan. |
| RF-OUT-07 | Must | Un administrador puede configurar una URL de webhook por formulario. |
| RF-OUT-08 | Must | Cada respuesta nueva envía un POST JSON al webhook con la respuesta y la definición de su versión, firmado con HMAC-SHA256 en una cabecera. |
| RF-OUT-09 | Must | Si el webhook falla, se reintenta hasta 5 veces con espera creciente y se registra el estado de cada intento. |
| RF-OUT-10 | Should | El administrador ve el historial de envíos de cada destino y puede reenviar uno fallido. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-OUT-01 | Must | Los envíos no bloquean la recepción de la respuesta (se procesan después de guardarla). |
| RNF-OUT-02 | Must | Email por SMTP configurable (Mailpit en local, Brevo u otro en la demo). |
| RNF-OUT-03 | Should | Exportar 5 000 respuestas a Excel tarda menos de 20 s. |
| RNF-OUT-04 | Must | Los CSV usan UTF-8 con BOM y separador `;` para abrirse bien en Excel en español. |

## Datos

- Posee: `Destination` y el registro de entregas.

## Dependencias

- Depende de: submissions-dashboard, form-schema, form-publishing, theming, file-storage.

## Criterios de aceptación

- **CA-OUT-01** — Dado un formulario con destino de email, cuando un trabajador envía una respuesta, entonces en Mailpit aparece un email con un PDF adjunto con el logo de la organización.
- **CA-OUT-02** — Dadas 3 respuestas filtradas, cuando se exporta a Excel, entonces el fichero tiene una fila de cabecera y 3 filas de datos.
- **CA-OUT-03** — Dado un webhook que responde 500, cuando llega una respuesta, entonces se registran reintentos y la respuesta queda guardada igualmente.
- **CA-OUT-04** — Dadas respuestas de v1 y v2 (la v2 con un campo nuevo), cuando se exporta, entonces hay una columna por campo y las respuestas de v1 tienen ese campo vacío.
- **CA-OUT-05** — Dado un valor que empieza por `=`, cuando se exporta, entonces no se interpreta como fórmula.
- **CA-OUT-06** — Dado un administrador de la organización A, cuando pide exportar un formulario de B, entonces recibe 404.

## Supuestos y preguntas abiertas

- Exportación (#28): sin colas ni streaming en el piloto; el servidor construye el fichero en memoria con un máximo de 10 000 filas (`EXPORT_MAX_ROWS`); por encima, error 400 que pide acotar con filtros. 5 000 filas caben en RNF-OUT-03.
- Exportación (#28): el enlace a fotos y firmas se forma con una función aislada (`buildFileExportLink`) que trata la clave como referencia opaca; `file-storage` fijará la ruta real y solo tendrá que cambiar esa función.

- Sin colas en el piloto: los envíos se procesan en segundo plano dentro del propio proceso, con estado persistido en base de datos para poder reintentar.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
- 2026-11-26 — Issue #28 (exportación a CSV y Excel): RF-OUT-06 decidido (columnas por `id` de campo, unión de versiones, columna de versión, fotos y firmas como enlace autenticado y no URL firmada de larga duración); nuevos RF-OUT-11 y RF-OUT-12; nuevos CA-OUT-04, CA-OUT-05 y CA-OUT-06; supuestos de la exportación.
