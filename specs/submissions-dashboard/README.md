# Respuestas y panel

- **Prefijo:** `SUB`
- **Estado:** diseñado
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #1 (análisis), #7 (diseño)

## Objetivo

Recibir y guardar las respuestas de forma fiable e idempotente, y mostrarlas al administrador como listado filtrable y fichas de detalle.

## Alcance

**Incluido**
- Endpoint de recepción de respuestas desde la PWA.
- Listado por formulario con filtros, búsqueda y paginación.
- Ficha de detalle con fotos, firma y mapa de la posición GPS.
- Panel de inicio con el número de respuestas de hoy, de la semana y por formulario.
- Disparo de las salidas configuradas (ver [outputs](../outputs/README.md)).

**Fuera de alcance**
- Edición de respuestas por el administrador, flujos de aprobación.
- Recepción real de respuestas desde la PWA (RF-SUB-01 a RF-SUB-04) y disparo de salidas (RF-SUB-09): dependen de `form-publishing` (estados y `FormVersion` reales) y `file-storage` (fotos y firma reales), ninguno de los dos con issue propio todavía. El issue #7 cubre solo el panel de solo lectura (RF-SUB-05 a RF-SUB-08, RF-SUB-10) usando respuestas de prueba creadas directamente en base de datos; se recomienda abrir `form-publishing` y `file-storage` como siguientes piezas (ver `design.md`).

## Decisiones

- **Sin edición de respuestas (confirmado en el hilo de #1).** El administrador solo consulta. La edición futura de una respuesta ya enviada queda pendiente como iteración posterior: tendrá que ser trazable (quién, cuándo, qué cambió), no una modificación silenciosa del JSONB, requerirá su propio permiso (ampliación de `RNF-AUT` en [tenancy-auth](../tenancy-auth/README.md)) y sus propios RF/CA numerados cuando se diseñe. No se reservan números ahora.

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-SUB-01 | Must | El servidor acepta una respuesta con `clientId`, versión del formulario, respuestas, referencias a archivos y metadatos. |
| RF-SUB-02 | Must | La recepción es idempotente por (`organizationId`, `clientId`): un reenvío devuelve la respuesta existente sin duplicarla. |
| RF-SUB-03 | Must | La respuesta se valida en el servidor contra el esquema de su `FormVersion`. |
| RF-SUB-04 | Must | Se guardan fecha de captura (del dispositivo) y fecha de sincronización (del servidor). |
| RF-SUB-05 | Must | El administrador ve el listado de respuestas de un formulario, ordenado de más reciente a más antigua, paginado de 20 en 20. |
| RF-SUB-06 | Must | Puede filtrar por rango de fechas, usuario y valor de un campo de selección única o sí/no. |
| RF-SUB-07 | Should | Puede buscar texto libre en las respuestas. |
| RF-SUB-08 | Must | La ficha de detalle muestra todas las respuestas visibles con las etiquetas de su versión, fotos en miniatura ampliables, firma y la posición en un mapa; no incluye ningún control para modificarlas. |
| RF-SUB-09 | Must | Tras guardar una respuesta, se disparan las salidas configuradas para el formulario. |
| RF-SUB-10 | Should | Un panel de inicio (`/admin`) muestra el número de respuestas de hoy, de la semana y por formulario. |
| RF-SUB-11 | Must | Cada respuesta guarda una copia inmutable del esquema (`FormVersion` de `form-schema`) con el que se rellenó, para mostrar siempre las etiquetas correctas aunque el formulario cambie después. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-SUB-01 | Must | Un fallo en una salida (email, webhook) no impide guardar la respuesta. |
| RNF-SUB-02 | Should | El listado carga en menos de 2 s con 10 000 respuestas por formulario. |
| RNF-SUB-03 | Must | No se registran en logs los valores de las respuestas. |

## Datos

- Posee: `Submission` (ver `design.md`; en el issue #7 `Submission.formId` es un identificador lógico, sin clave foránea a `Form` de `form-editor` ni a `FormVersion` de `form-publishing`, ninguno de los dos exigido como dependencia de este issue).

## Dependencias

- Depende de: [form-schema](../form-schema/README.md), [tenancy-auth](../tenancy-auth/README.md) — en el alcance del issue #7. El módulo completo depende además de form-publishing y file-storage (ver "Fuera de alcance"), que se añadirán cuando se diseñe la recepción real (RF-SUB-01 a RF-SUB-04, RF-SUB-09).
- Lo usan: outputs, public-api, privacy-gdpr.

## Criterios de aceptación

- **CA-SUB-01** — Dada una respuesta recibida, cuando llega de nuevo con el mismo `clientId`, entonces el servidor responde 200 con la misma respuesta y no se disparan de nuevo las salidas.
- **CA-SUB-02** — Dado un filtro "¿Hay incidencias? = sí", cuando se aplica, entonces solo aparecen las respuestas con ese valor.
- **CA-SUB-03** — Dada una respuesta con GPS, cuando se abre su ficha, entonces se ve un mapa con la posición.
- **CA-SUB-04** — Dado un formulario con más de 20 respuestas, cuando se abre su listado, entonces se muestran como máximo 20 por página, ordenadas de más reciente a más antigua, con un control para ver el resto de páginas.
- **CA-SUB-05** — Dado un texto que aparece en una respuesta de tipo texto, cuando se busca ese texto en el listado, entonces solo aparecen las respuestas que lo contienen, sin distinguir mayúsculas y minúsculas.
- **CA-SUB-06** — Dadas respuestas recibidas hoy y esta semana en varios formularios, cuando se abre el panel de inicio (`/admin`), entonces se muestra el número de respuestas de hoy, de la semana y el desglose por formulario.
- **CA-SUB-07** — Dada la ficha de detalle de una respuesta, cuando se consulta como administrador, entonces no hay ningún control para modificar las respuestas (solo lectura).
- **CA-SUB-08** — Dado un rango de fechas y un usuario como filtro, cuando se aplican juntos, entonces solo aparecen las respuestas capturadas en ese rango y enviadas por ese usuario.
- **CA-SUB-09** — Dada una respuesta con fotos y firma, cuando se abre su ficha, entonces se muestran las miniaturas de las fotos (ampliables a tamaño completo) y la imagen de la firma.

## Supuestos y preguntas abiertas

- Proveedor de mapas para la ficha: **decidido en #7** — OpenStreetMap con `leaflet` + `react-leaflet`, sin clave de API (nuevas dependencias de npm, pendientes de la aprobación del arquitecto en el issue).
- Mientras `file-storage` no exista, las fotos y la firma de la ficha de detalle se muestran con una imagen de marcador de posición fija (`public/placeholder-photo.svg`, `public/placeholder-signature.svg`); `file-storage` sustituirá esto por la URL firmada real (`RF-STO-02`).
- Mientras no exista una `FormVersion` "actual" por formulario (la creará `form-publishing`), los campos disponibles para el filtro de selección/sí-no (RF-SUB-06) se obtienen del `formVersionSnapshot` de la respuesta más reciente de ese `formId`; si no hay ninguna respuesta todavía, no se ofrece ningún filtro de campo.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
- 2026-11-18 — Issue #7: alcance de la pieza (listado, ficha de detalle y panel de inicio, solo lectura, con datos de prueba); RF-SUB-05 y RF-SUB-08 precisados (paginación de 20, "sin ningún control para modificarlas"); nuevo RF-SUB-11 (copia inmutable del esquema en cada respuesta); nuevas CA-SUB-04 a CA-SUB-09; documentada la decisión de #1 sobre la futura edición de respuestas; `Submission.formId` sin clave foránea a `Form`/`FormVersion`; proveedor de mapas decidido (Leaflet/OpenStreetMap, dependencias nuevas pendientes de aprobación).
