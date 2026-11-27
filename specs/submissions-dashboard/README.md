# Respuestas y panel

- **Prefijo:** `SUB`
- **Estado:** diseñado
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #1 (análisis), #7 (diseño), #27 (recepción de respuestas)

## Objetivo

Recibir y guardar las respuestas de forma fiable e idempotente, y mostrarlas al administrador como listado filtrable y fichas de detalle.

## Alcance

**Incluido**
- Servicio de servidor `createSubmission` (#27): recibe, valida contra la versión indicada y guarda una respuesta de forma idempotente, para uso de la pantalla de relleno, el modo sin conexión y la API. El endpoint HTTP que lo expone lo construyen esos consumidores (#23 y siguientes).
- Versión del formulario de cada respuesta, visible en el listado y filtrable (#27).
- Listado por formulario con filtros, búsqueda y paginación.
- Ficha de detalle con fotos, firma y mapa de la posición GPS.
- Panel de inicio con el número de respuestas de hoy, de la semana y por formulario.
- Disparo de las salidas configuradas (ver [outputs](../outputs/README.md)).

**Fuera de alcance**
- Edición de respuestas por el administrador, flujos de aprobación.
- Disparo de las salidas tras guardar (RF-SUB-09): pertenece a `outputs`.
- Pantalla de relleno, subida de archivos (`file-storage`), envíos por email o webhook y borrado por caducidad (#24).
- Contador real de respuestas en el listado de formularios (lo cablea `form-editor`).
- Histórico: el issue #7 cubrió solo el panel de solo lectura (RF-SUB-05 a RF-SUB-08, RF-SUB-10); el issue #27 cubre la recepción (RF-SUB-01 a RF-SUB-04, RF-SUB-11 y RF-SUB-12). El servicio recibe el esquema como dato, así que no depende del código de `form-publishing`.

## Decisiones

- **Sin edición de respuestas (confirmado en el hilo de #1).** El administrador solo consulta. La edición futura de una respuesta ya enviada queda pendiente como iteración posterior: tendrá que ser trazable (quién, cuándo, qué cambió), no una modificación silenciosa del JSONB, requerirá su propio permiso (ampliación de `RNF-AUT` en [tenancy-auth](../tenancy-auth/README.md)) y sus propios RF/CA numerados cuando se diseñe. No se reservan números ahora.

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-SUB-01 | Must | El servidor acepta una respuesta con `clientId`, versión del formulario (con su esquema), respuestas, referencias a archivos y metadatos. La organización la decide quien llama a partir del formulario, nunca el cliente; un usuario autenticado solo puede guardar en su propia organización. Se registra quién la envió (usuario autenticado: id y nombre; anónimo de formulario público: ninguno). El JSON de respuestas tiene un tamaño máximo. (#27) |
| RF-SUB-02 | Must | La recepción es idempotente por (`organizationId`, `clientId`): un reenvío devuelve la respuesta existente sin duplicarla. |
| RF-SUB-03 | Must | La respuesta se valida en el servidor contra el esquema de **la versión indicada** (no la última) y, en fotos y firma, las claves de archivo deben pertenecer a la propia organización. Los errores indican campo y mensaje, nunca valores de respuesta. (#27) |
| RF-SUB-04 | Must | Se guardan fecha de captura (del dispositivo) y fecha de sincronización (del servidor). |
| RF-SUB-05 | Must | El administrador ve el listado de respuestas de un formulario, ordenado de más reciente a más antigua, paginado de 20 en 20. |
| RF-SUB-06 | Must | Puede filtrar por rango de fechas, usuario y valor de un campo de selección única o sí/no. |
| RF-SUB-07 | Should | Puede buscar texto libre en las respuestas. |
| RF-SUB-08 | Must | La ficha de detalle muestra todas las respuestas visibles con las etiquetas de su versión, fotos en miniatura ampliables, firma y la posición en un mapa; no incluye ningún control para modificarlas. |
| RF-SUB-09 | Must | Tras guardar una respuesta, se disparan las salidas configuradas para el formulario. |
| RF-SUB-10 | Should | Un panel de inicio (`/admin`) muestra el número de respuestas de hoy, de la semana y por formulario. |
| RF-SUB-11 | Must | Cada respuesta guarda una copia inmutable del esquema (`FormVersion` de `form-schema`) con el que se rellenó, para mostrar siempre las etiquetas correctas aunque el formulario cambie después. |
| RF-SUB-12 | Must | Cada respuesta indica la versión del formulario con la que se recogió (id y número, opcionales en respuestas anteriores a #27), el listado la muestra y se puede filtrar por ella. (#27) |
| RF-SUB-13 | Must | La recepción respeta el límite `maxSubmissionsPerHour` del plan de la organización (ver [`admin-settings`](../admin-settings/README.md), RF-SET-11): una respuesta nueva que supera el límite se rechaza con `PlanLimitError` y no se guarda; un reenvío idempotente no consume cupo. (#40) |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-SUB-01 | Must | Un fallo en una salida (email, webhook) no impide guardar la respuesta. |
| RNF-SUB-02 | Should | El listado carga en menos de 2 s con 10 000 respuestas por formulario. |
| RNF-SUB-03 | Must | No se registran en logs los valores de las respuestas. |

## Datos

- #27 añade a `Submission` `formVersionId`, `formVersionNumber` y `submittedByUserId`, los tres opcionales y sin clave foránea.
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
- **CA-SUB-10** — Dada una respuesta válida, cuando se envía dos veces con el mismo `clientId`, entonces solo existe una fila y la segunda llamada devuelve la existente (`created: false`). (#27)
- **CA-SUB-11** — Dada una respuesta que incumple un campo obligatorio de su versión, cuando se envía, entonces se rechaza señalando el campo y no se guarda. (#27)
- **CA-SUB-12** — Dada una respuesta de la versión 1 enviada cuando ya existe la versión 2 con un campo obligatorio nuevo, cuando se envía con el esquema de la v1, entonces se acepta (se valida contra la v1). (#27)
- **CA-SUB-13** — Dado un usuario de la organización A, cuando intenta guardar con la organización B, entonces se rechaza y no se guarda. (#27)
- **CA-SUB-14** — Dadas respuestas de dos versiones del mismo formulario, cuando se abre el listado, entonces cada fila muestra su versión y el filtro por versión deja solo las de esa versión. (#27)
- **CA-SUB-15** — Dado un plan con `maxSubmissionsPerHour` = 2, cuando se envían 3 respuestas distintas en la misma hora, entonces la tercera se rechaza con `PlanLimitError` y no se guarda; y el reenvío de la primera devuelve la guardada sin consumir cupo. Se detalla en CA-SET-02 y CA-SET-03. (#40)

## Supuestos y preguntas abiertas

- Proveedor de mapas para la ficha: **decidido en #7** — OpenStreetMap con `leaflet` + `react-leaflet`, sin clave de API (nuevas dependencias de npm, pendientes de la aprobación del arquitecto en el issue).
- Mientras `file-storage` no exista, las fotos y la firma de la ficha de detalle se muestran con una imagen de marcador de posición fija (`public/placeholder-photo.svg`, `public/placeholder-signature.svg`); `file-storage` sustituirá esto por la URL firmada real (`RF-STO-02`).
- Mientras no exista una `FormVersion` "actual" por formulario (la creará `form-publishing`), los campos disponibles para el filtro de selección/sí-no (RF-SUB-06) se obtienen del `formVersionSnapshot` de la respuesta más reciente de ese `formId`; si no hay ninguna respuesta todavía, no se ofrece ningún filtro de campo.

## Historial de cambios

- 2026-11-27 — Issue #40: nuevo RF-SUB-13 y CA-SUB-15 (límite de recepciones por hora del plan; se prueba con el plan de `admin-settings`).
- 2026-11-14 — Creación del módulo.
- 2026-11-26 — Issue #27: recepción real (RF-SUB-01 a RF-SUB-04 pasan de "fuera de alcance" a incluidos, precisados); nuevo RF-SUB-12 (versión en cada respuesta, visible y filtrable); nuevas CA-SUB-10 a CA-SUB-14; `Submission` gana `formVersionId`, `formVersionNumber` y `submittedByUserId`. RF-SUB-09 sigue fuera (pertenece a `outputs`). CA-SUB-01 se cubre a nivel de servicio con CA-SUB-10 (el 200 HTTP lo da quien llama).
- 2026-11-18 — Issue #7: alcance de la pieza (listado, ficha de detalle y panel de inicio, solo lectura, con datos de prueba); RF-SUB-05 y RF-SUB-08 precisados (paginación de 20, "sin ningún control para modificarlas"); nuevo RF-SUB-11 (copia inmutable del esquema en cada respuesta); nuevas CA-SUB-04 a CA-SUB-09; documentada la decisión de #1 sobre la futura edición de respuestas; `Submission.formId` sin clave foránea a `Form`/`FormVersion`; proveedor de mapas decidido (Leaflet/OpenStreetMap, dependencias nuevas pendientes de aprobación).
