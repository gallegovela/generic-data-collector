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
| RF-OUT-13 | Must | Los envíos solo se disparan cuando la respuesta se crea de verdad (`created === true`); la respuesta se guarda siempre, aunque falle el envío o su preparación. |
| RF-OUT-14 | Must | Un formulario tiene como máximo un destino de email (hasta 10 direcciones) y uno de webhook. Cada par (destino, respuesta) genera como mucho un envío: reenviar la misma respuesta (mismo `clientId`) no duplica emails ni POST. |
| RF-OUT-15 | Must | La URL del webhook solo puede ser `http` o `https` y se rechaza al configurarla si apunta a una IP privada, de enlace local o de metadatos (y a loopback / `localhost` en producción). El destino se vuelve a comprobar al enviar (resolución DNS) y no se siguen redirecciones; la espera máxima es de 10 s. |
| RF-OUT-16 | Must | Solo un administrador de la organización propietaria puede ver, crear, cambiar, borrar o reenviar destinos y envíos de un formulario; en otro caso, 404. El secreto del webhook se genera por destino (`whsec_` + 64 hex), se muestra una sola vez al crearlo o regenerarlo y nunca se vuelve a mostrar. |
| RF-OUT-17 | Must | El PDF adjunto no supera `EMAIL_MAX_ATTACHMENT_BYTES` (10 MB por defecto): si con imágenes lo supera, se genera sin imágenes y con un aviso y un enlace a la ficha autenticada. |
| RF-OUT-18 | Must | El webhook firma `"<timestamp>.<cuerpo>"` con HMAC-SHA256 y el secreto del destino; cabeceras `X-FormIA-Signature: sha256=<hex>`, `X-FormIA-Timestamp` (segundos Unix), `X-FormIA-Event: submission.created` y `X-FormIA-Delivery: <id>`. Las imágenes viajan como claves de archivo, nunca como URLs. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-OUT-01 | Must | Los envíos no bloquean la recepción de la respuesta (se procesan después de guardarla). |
| RNF-OUT-02 | Must | Email por SMTP configurable (Mailpit en local, Brevo u otro en la demo). |
| RNF-OUT-03 | Should | Exportar 5 000 respuestas a Excel tarda menos de 20 s. |
| RNF-OUT-04 | Must | Los CSV usan UTF-8 con BOM y separador `;` para abrirse bien en Excel en español. |
| RNF-OUT-05 | Must | Ni los logs ni los errores guardados contienen respuestas, destinatarios, URLs de webhook ni secretos; solo identificadores, estado y códigos HTTP. |
| RNF-OUT-06 | Must | Los envíos pendientes se reanudan solos tras reiniciar el proceso (procesador periódico dentro de la app, sin cron ni cola externa). Limitación del piloto: sin proceso vivo no hay reintentos. |

## Datos

- Posee: `Destination`, `Delivery` (un envío por destino y respuesta) y `DeliveryAttempt` (cada intento). Ver [design.md](design.md).

## Dependencias

- Depende de: submissions-dashboard, form-schema, form-publishing, theming, file-storage.

## Criterios de aceptación

- **CA-OUT-01** — Dado un formulario con destino de email, cuando un trabajador envía una respuesta, entonces en Mailpit aparece un email con un PDF adjunto con el logo de la organización.
- **CA-OUT-02** — Dadas 3 respuestas filtradas, cuando se exporta a Excel, entonces el fichero tiene una fila de cabecera y 3 filas de datos.
- **CA-OUT-03** — Dado un webhook que responde 500, cuando llega una respuesta, entonces se registran reintentos y la respuesta queda guardada igualmente.
- **CA-OUT-04** — Dadas respuestas de v1 y v2 (la v2 con un campo nuevo), cuando se exporta, entonces hay una columna por campo y las respuestas de v1 tienen ese campo vacío.
- **CA-OUT-05** — Dado un valor que empieza por `=`, cuando se exporta, entonces no se interpreta como fórmula.
- **CA-OUT-06** — Dado un administrador de la organización A, cuando pide exportar un formulario de B, entonces recibe 404.
- **CA-OUT-07** — Dado un destino de webhook, cuando llega una respuesta, entonces el POST lleva `X-FormIA-Signature` y `X-FormIA-Timestamp` y la firma se verifica con el secreto del destino.
- **CA-OUT-08** — Dada la misma respuesta recibida dos veces con el mismo `clientId`, entonces se envía un solo email y un solo POST.
- **CA-OUT-09** — Dado un administrador de la organización A, cuando intenta ver, crear, cambiar o reenviar destinos de un formulario de B, entonces recibe 404 y no se crea nada.
- **CA-OUT-10** — Dada una URL de webhook a una IP privada (p. ej. `http://10.0.0.5/hook` o `http://169.254.169.254/`), cuando se configura, entonces se rechaza con error de validación.
- **CA-OUT-11** — Dado un envío fallido, cuando el administrador pulsa «Reenviar», entonces vuelve a ponerse en cola y, si el destino responde bien, queda como enviado con sus intentos registrados.
- **CA-OUT-12** — Dado el PDF de una respuesta con logo y firma, cuando el administrador lo descarga desde su ficha, entonces recibe un PDF (`application/pdf`) con las imágenes embebidas; de otra organización, 404.
- **CA-OUT-13** — Dado un PDF que con imágenes superaría el tope, entonces el email lleva un PDF por debajo del tope, sin imágenes y con el aviso.

## Supuestos y preguntas abiertas

- Exportación (#28): sin colas ni streaming en el piloto; el servidor construye el fichero en memoria con un máximo de 10 000 filas (`EXPORT_MAX_ROWS`); por encima, error 400 que pide acotar con filtros. 5 000 filas caben en RNF-OUT-03.
- Exportación (#28): el enlace a fotos y firmas se forma con una función aislada (`buildFileExportLink`) que trata la clave como referencia opaca; `file-storage` fijará la ruta real y solo tendrá que cambiar esa función.
- Exportación (#28): el origen de los enlaces a archivos es `AUTH_URL` si está definida (ya figura en `.env.example`) y, si no, `request.nextUrl.origin`; detrás de un proxy `origin` puede ser un host interno.
- Exportación (#28): un formulario sin respuestas en la organización (o inexistente, o de otra organización) da 404 con el mismo cuerpo; la interfaz solo ofrece los botones si `total > 0`, y unos filtros sin coincidencias dan 200 con solo cabeceras.
- Exportación (#28): el CSV escribe los números con punto decimal; Excel en configuración regional española puede leerlos como texto. Limitación conocida del piloto. Los valores de texto como `+34600123456` (solo dígitos) no se neutralizan porque no son fórmulas.
- Exportación (#28): las fotos múltiples de una celda se separan con un salto de línea.

- Sin colas en el piloto: los envíos se procesan en segundo plano dentro del propio proceso, con estado persistido en base de datos para poder reintentar.
- Destinos (#35): «hasta 5 intentos» = 5 intentos en total (el primero más 4 reintentos), con esperas de 1 min, 5 min, 30 min y 2 h. El reenvío manual abre una ronda nueva de 5 intentos.
- Destinos (#35): el logo y los colores del PDF salen de `formVersionSnapshot.theme` (`logoKey`, `primaryColor`, `secondaryColor`), que ya existe en el esquema de `form-schema`; sin tema se usa un estilo neutro. Cuando `theming` guarde el tema por organización, solo cambiará la función `resolvePdfTheme`. La tipografía del tema no se aplica al PDF (fuente estándar Helvetica).
- Destinos (#35): `@react-pdf/renderer` solo incrusta JPG y PNG; fotos WEBP/HEIC se sustituyen en el PDF por el texto «[imagen no incluida: formato no admitido en PDF]». Máximo 12 imágenes por PDF; el resto se indican como «+N imágenes en la ficha».
- Destinos (#35): el secreto del webhook se guarda en claro en la base de datos (hace falta para firmar); se aceptará cifrarlo cuando `privacy-gdpr` lo defina.
- Destinos (#35): el email lleva datos personales; la pantalla de destinos avisa de que el administrador es responsable de elegir los destinatarios.
- Destinos (#35): `SMTP_FROM` debe ser un remitente verificado con un SMTP real (Brevo).

## Historial de cambios

- 2026-11-14 — Creación del módulo.
- 2026-11-26 — Issue #28 (exportación a CSV y Excel): RF-OUT-06 decidido (columnas por `id` de campo, unión de versiones, columna de versión, fotos y firmas como enlace autenticado y no URL firmada de larga duración); nuevos RF-OUT-11 y RF-OUT-12; nuevos CA-OUT-04, CA-OUT-05 y CA-OUT-06; supuestos de la exportación.
- 2026-11-26 — Issue #28, revisión del arquitecto: `AUTH_URL` para los enlaces, 404 sin respuestas, limitación del CSV con números, fotos separadas por salto de línea. `Submission.formVersionNumber` aprobado (lo rellenará `form-publishing`).
- 2026-11-26 — Issue #35 (destinos: email con PDF y webhook firmado): nuevos RF-OUT-13 a RF-OUT-18, RNF-OUT-05 y RNF-OUT-06, CA-OUT-07 a CA-OUT-13; supuestos de reintentos, tema del PDF, imágenes y secreto. RF-OUT-01 a 04 y 07 a 10, CA-OUT-01 y CA-OUT-03 se implementan aquí.
