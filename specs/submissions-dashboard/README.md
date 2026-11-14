# Respuestas y panel

- **Prefijo:** `SUB`
- **Estado:** borrador
- **Dueño de los requisitos:** architect

## Objetivo

Recibir y guardar las respuestas de forma fiable e idempotente, y mostrarlas al administrador como listado filtrable y fichas de detalle.

## Alcance

**Incluido**
- Endpoint de recepción de respuestas desde la PWA.
- Listado por formulario con filtros y búsqueda.
- Ficha de detalle con fotos, firma y mapa de la posición GPS.
- Disparo de las salidas configuradas (ver [outputs](../outputs/README.md)).

**Fuera de alcance**
- Edición de respuestas por el administrador, flujos de aprobación.

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-SUB-01 | Must | El servidor acepta una respuesta con `clientId`, versión del formulario, respuestas, referencias a archivos y metadatos. |
| RF-SUB-02 | Must | La recepción es idempotente por (`organizationId`, `clientId`): un reenvío devuelve la respuesta existente sin duplicarla. |
| RF-SUB-03 | Must | La respuesta se valida en el servidor contra el esquema de su `FormVersion`. |
| RF-SUB-04 | Must | Se guardan fecha de captura (del dispositivo) y fecha de sincronización (del servidor). |
| RF-SUB-05 | Must | El administrador ve el listado de respuestas de un formulario, ordenado por fecha, con paginación. |
| RF-SUB-06 | Must | Puede filtrar por rango de fechas, usuario y valor de campos de selección o sí/no. |
| RF-SUB-07 | Should | Puede buscar texto libre en las respuestas. |
| RF-SUB-08 | Must | La ficha de detalle muestra todas las respuestas con las etiquetas de su versión, fotos en miniatura ampliables, firma y la posición en un mapa. |
| RF-SUB-09 | Must | Tras guardar una respuesta, se disparan las salidas configuradas para el formulario. |
| RF-SUB-10 | Should | Un panel de inicio muestra el número de respuestas de hoy, de la semana y por formulario. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-SUB-01 | Must | Un fallo en una salida (email, webhook) no impide guardar la respuesta. |
| RNF-SUB-02 | Should | El listado carga en menos de 2 s con 10 000 respuestas por formulario. |
| RNF-SUB-03 | Must | No se registran en logs los valores de las respuestas. |

## Datos

- Posee: `Submission`.

## Dependencias

- Depende de: form-schema, form-publishing, file-storage, tenancy-auth.
- Lo usan: outputs, public-api, privacy-gdpr.

## Criterios de aceptación

- **CA-SUB-01** — Dada una respuesta recibida, cuando llega de nuevo con el mismo `clientId`, entonces el servidor responde 200 con la misma respuesta y no se disparan de nuevo las salidas.
- **CA-SUB-02** — Dado un filtro "¿Hay incidencias? = sí", cuando se aplica, entonces solo aparecen las respuestas con ese valor.
- **CA-SUB-03** — Dada una respuesta con GPS, cuando se abre su ficha, entonces se ve un mapa con la posición.

## Supuestos y preguntas abiertas

- Proveedor de mapas para la ficha: propuesta OpenStreetMap (Leaflet), sin clave de API.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
