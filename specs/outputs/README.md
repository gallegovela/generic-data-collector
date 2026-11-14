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
| RF-OUT-06 | Must | En la exportación, cada campo es una columna con su etiqueta; las fotos y firmas se exportan como enlaces firmados de larga duración o como nombres de archivo (pendiente de decidir). |
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

## Supuestos y preguntas abiertas

- Sin colas en el piloto: los envíos se procesan en segundo plano dentro del propio proceso, con estado persistido en base de datos para poder reintentar.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
