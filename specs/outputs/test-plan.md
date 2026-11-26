# Salidas de datos — Plan de pruebas

- **Requisitos:** [README.md](README.md)
- **Diseño:** [design.md](design.md)
- **Responsable:** analyst-programmer (escribe en `design` y lo ejecuta en `testPR`), architect (revisa)
- **Issues:** #28 (exportación a CSV y Excel), #35 (destinos: email con PDF y webhook firmado)

Este plan se ejecuta en la etapa `testPR`, sobre la rama `issue-<n>` de la pull request (con la última rama principal fusionada) y **antes de fusionarla**. Todo se ejecuta en el entorno de pruebas en contenedores (ver "Pruebas en contenedores" en `specs/platform/design.md`): cada comando va dentro del contenedor `tests` con `npm run test:stack:run -- <comando>`, y los servicios se llaman por su nombre (`web`, `postgres`, `minio`, `mailpit`), nunca `localhost`. Los casos PP-OUT-01 a PP-OUT-08 cubren #28 (exportación a CSV y Excel); PP-OUT-09 a PP-OUT-19 cubren #35 (destinos de email con PDF y webhook firmado). Si la PR es de #28, se ejecutan solo los primeros; si es de #35, todos (los primeros sirven de regresión). Los casos de #35 necesitan Mailpit (`mailpit`, API HTTP en `http://mailpit:8025`) y un servidor HTTP local que levanta el propio test; la PR añade `SMTP_HOST: mailpit` y `DELIVERY_POLLER_ENABLED: "false"` a `docker-compose.test.yml` (hoy no están). Los casos con `-t "<texto>"` esperan que el programador ponga ese texto (el identificador del criterio, p. ej. `CA-OUT-04`) en el nombre del test. **Vitest sale con 0 aunque `-t` no coincida con nada**, así que esos casos se ejecutan con `--reporter=verbose` y solo se dan por superados si, además del código 0, la salida muestra al menos el número indicado de tests con ese identificador en el nombre (✓) y 0 saltados (`skipped`) o fallidos. Si no aparece ninguno, el caso es ❌ (falso verde).

## Preparación

```bash
npm run test:stack:up
npm run test:stack:run -- npm run db:seed        # usuario admin demo, necesario para Playwright
```

## Comprobaciones generales

| ID | Comando |
| --- | --- |
| PP-OUT-G1 | `npm run test:stack:run -- npm run lint` |
| PP-OUT-G2 | `npm run test:stack:run -- npm run typecheck` |
| PP-OUT-G3 | `npm run test:stack:run -- npm test` |
| PP-OUT-G4 | `npm run test:stack:run -- npm run build` |
| PP-OUT-G5 | `npm run test:stack:run -- npx playwright test` |

PP-OUT-G3 y PP-OUT-G5 incluyen los tests de `submissions-dashboard`, que deben seguir en verde tras el refactor de `buildSubmissionWhere` y `toListFilters` (no hay regresión del listado).

## Casos de prueba

### PP-OUT-01 — Excel con cabecera y filas filtradas

- **Cubre:** CA-OUT-02, RF-OUT-05
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna (el test crea 5 respuestas, 3 de ellas coinciden con un filtro de `submittedBy`).
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/outputs/xlsx.test.ts src/server/outputs/export.service.test.ts -t "CA-OUT-02" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 2 tests `CA-OUT-02` ejecutados (✓) en la salida (uno en `xlsx.test.ts` y otro en `export.service.test.ts`) y 0 saltados; el `.xlsx` generado, leído con exceljs, tiene 1 fila de cabecera y 3 de datos; un campo numérico queda como celda numérica.

### PP-OUT-02 — Unión de versiones

- **Cubre:** CA-OUT-04, RF-OUT-06
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/outputs/export-table.test.ts -t "CA-OUT-04" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 1 test `CA-OUT-04` ejecutado (✓) y 0 saltados; con respuestas v1 y v2 (v2 con campo nuevo) hay una columna por campo, una sola para los campos comunes, la columna nueva vacía en las filas v1, la cabecera usa la etiqueta de la v2 y existe la columna "Versión".

### PP-OUT-03 — Neutralización de fórmulas

- **Cubre:** CA-OUT-05, RF-OUT-12
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/outputs/cell-safety.test.ts src/lib/outputs/format-cell.test.ts src/lib/outputs/csv.test.ts src/server/outputs/xlsx.test.ts -t "CA-OUT-05" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 4 tests `CA-OUT-05` ejecutados (✓; uno por fichero `cell-safety`, `format-cell`, `csv` y `xlsx`) y 0 saltados; un valor `=1+1` sale como `'=1+1` en la celda y en el CSV; lo mismo para `+`, `-` y `@` iniciales, `-1+1`, `=SUMA(A1)`, `\t=1` y `\r=1`; un número negativo, unas coordenadas negativas y `+34600123456` no se alteran; en el xlsx la celda es de tipo texto, no fórmula.

### PP-OUT-04 — Formato del CSV

- **Cubre:** RNF-OUT-04
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/outputs/csv.test.ts
  ```
- **Resultado esperado:** código de salida 0; el texto empieza por `﻿`, separa con `;`, escapa celdas con `;`, comillas o saltos de línea y termina las filas en `\r\n`.

### PP-OUT-05 — Formato de cada tipo de campo y enlaces de archivos

- **Cubre:** RF-OUT-06
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/outputs/format-cell.test.ts src/lib/outputs/file-link.test.ts
  ```
- **Resultado esperado:** código de salida 0; sí/no = "Sí"/"No", selección múltiple = etiquetas, GPS = `lat, lng`, foto y firma = enlace `<baseUrl>/api/files/<clave codificada>`, ningún enlace contiene firma ni caducidad en la query.

### PP-OUT-06 — Aislamiento por organización en el servicio

- **Cubre:** CA-OUT-06, RF-OUT-11
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna (el test crea las organizaciones A y B con el mismo `formId` y una respuesta solo en A).
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/outputs/export.service.test.ts src/server/submissions/submission.repository.test.ts -t "CA-OUT-06" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 2 tests `CA-OUT-06` ejecutados (✓; uno en el servicio y uno en el repositorio) y 0 saltados; `exportSubmissions(orgB, formIdDeA, ...)` lanza `NotFoundError`; `listSubmissionsForExport(orgB, ...)` devuelve `[]` y `countSubmissionsOfForm(orgB, ...)` devuelve 0.

### PP-OUT-07 — Lo exportado coincide con el listado y límite de filas

- **Cubre:** RF-OUT-11, RNF-OUT-03
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/outputs/export.service.test.ts submissions/export/route.test.ts -t "RF-OUT-11" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 3 tests `RF-OUT-11` ejecutados (✓; coincidencia con el listado, límite de filas y `baseUrl` del handler con `AUTH_URL`/`origin`) y 0 saltados; con filtros de fecha, usuario, campo y texto, el nº de filas exportadas es igual a `total` de `listSubmissionsByForm`; superar `EXPORT_MAX_ROWS` lanza `ValidationError`.

### PP-OUT-08 — Descarga HTTP real (permisos y 404)

- **Cubre:** CA-OUT-02, CA-OUT-04, CA-OUT-05, CA-OUT-06
- **Tipo:** automático (Playwright)
- **Precondiciones:** datos demo (`db:seed`); el propio spec crea sus respuestas v1/v2 y una segunda organización con un administrador.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx playwright test e2e/outputs-export.spec.ts
  ```
- **Resultado esperado:** código de salida 0; con sesión admin, `GET /api/forms/<id>/submissions/export?format=csv` devuelve 200, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition` con `attachment` y el cuerpo empieza por BOM; `format=xlsx` devuelve 200 con el tipo MIME de xlsx; sin sesión 401; con rol `collector` 403; con un administrador de otra organización 404; con un `id` de formulario inexistente 404, con el mismo cuerpo que el de otra organización; `format=pdf` o sin `format` 400; la página del listado muestra los enlaces "Exportar a Excel" y "Exportar a CSV" con los filtros activos en el `href`.

### PP-OUT-09 — Email con PDF adjunto y logo en Mailpit

- **Cubre:** CA-OUT-01, RF-OUT-01, RF-OUT-02, RF-OUT-03
- **Tipo:** automático (Vitest, BD real, SMTP real a Mailpit)
- **Precondiciones:** `grep -n SMTP_HOST docker-compose.test.yml` debe devolver al menos una línea (si no, la PR olvidó añadirlo: caso ❌ con ese motivo, no un email que no llega). El test sube un logo PNG, crea organización, formulario, destino de email con destinatario único y la respuesta.
- **Pasos:**
  ```bash
  grep -n SMTP_HOST docker-compose.test.yml
  npm run test:stack:run -- npx vitest run src/server/outputs/delivery.integration.test.ts src/lib/outputs/pdf-model.test.ts -t "CA-OUT-01" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 1 test `CA-OUT-01` ejecutado (✓) y 0 saltados; en Mailpit hay exactamente 1 mensaje al destinatario, con un adjunto `application/pdf` que empieza por `%PDF-`, de tamaño > 0 y con al menos un `/Subtype /Image` (logo); el cuerpo del email no contiene ninguna respuesta.

### PP-OUT-10 — Webhook con 500: reintentos registrados y respuesta guardada

- **Cubre:** CA-OUT-03, RF-OUT-09
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/outputs/delivery.integration.test.ts src/lib/outputs/delivery-policy.test.ts -t "CA-OUT-03" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 2 tests `CA-OUT-03` ejecutados (✓; uno en cada fichero) y 0 saltados; con un servidor que responde 500: 5 `DeliveryAttempt` con `ok=false` y `statusCode=500`, `Delivery.status = failed`, `lastError = HTTP_500`, esperas 60/300/1800/7200 s, y la `Submission` existe.

### PP-OUT-11 — Firma del webhook verificable con el secreto del destino

- **Cubre:** CA-OUT-07, RF-OUT-08, RF-OUT-18
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/outputs/webhook-signature.test.ts src/server/outputs/delivery.integration.test.ts -t "CA-OUT-07" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 2 tests `CA-OUT-07` ejecutados (✓) y 0 saltados; el POST real recibido lleva `X-FormIA-Signature` (`sha256=<64 hex>`), `X-FormIA-Timestamp` y `X-FormIA-Event: submission.created`; `verifyWebhookSignature` con el secreto del destino da `true` y con otro secreto, cuerpo alterado o marca de tiempo caducada da `false`; las imágenes viajan como `{ key }`, sin URLs.

### PP-OUT-12 — Reenvío idempotente: un solo email y un solo POST

- **Cubre:** CA-OUT-08, RF-OUT-13, RF-OUT-14
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/outputs/delivery.integration.test.ts src/server/outputs/delivery.repository.test.ts -t "CA-OUT-08" --reporter=verbose
  ```
  ```bash
  npm run test:stack:run -- npx vitest run src/server/submissions/submission.service.test.ts src/server/outputs/delivery.integration.test.ts -t "RF-OUT-13" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0 en ambos; al menos 2 tests `CA-OUT-08` y al menos 4 tests `RF-OUT-13` (✓; tres en `submission.service.test.ts` y uno en la integración) y 0 saltados; con el mismo `clientId` enviado dos veces hay 1 `Delivery` por destino, 1 mensaje en Mailpit y 1 POST; una respuesta `created:false` no encola; si `scheduleDeliveries` falla o el destino está caído, `createSubmission` sigue devolviendo `created: true` y la respuesta existe.

### PP-OUT-13 — Aislamiento por organización de destinos, envíos y PDF

- **Cubre:** CA-OUT-09, RF-OUT-16
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/outputs/destination.service.test.ts src/server/outputs/delivery.integration.test.ts src/server/outputs/submission-pdf.service.test.ts "pdf/route.test.ts" -t "CA-OUT-09" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 4 tests `CA-OUT-09` ejecutados (✓; servicio de destinos, integración de envíos, servicio del PDF y handler del PDF) y 0 saltados; la organización B recibe `NotFoundError` (404 en el handler) sobre datos de A y no se crea ninguna fila; el secreto solo se devuelve al crear.

### PP-OUT-14 — Protección SSRF del webhook

- **Cubre:** CA-OUT-10, RF-OUT-15
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/outputs/webhook-url.test.ts src/lib/outputs/destination.schema.test.ts src/server/outputs/webhook-sender.test.ts -t "CA-OUT-10" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 3 tests `CA-OUT-10` ejecutados (✓; uno por fichero) y 0 saltados; se rechazan `http://10.0.0.5/hook`, `http://169.254.169.254/`, `http://192.168.1.1`, `http://[fd00::1]/`, `ftp://x` y URLs con credenciales; loopback solo se acepta con `allowLoopback: true`; un host que resuelve a IP privada da `BLOCKED_HOST` sin llamar a `fetch`; una redirección 302 no se sigue.

### PP-OUT-15 — Reenvío manual de un envío fallido

- **Cubre:** CA-OUT-11, RF-OUT-10
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/outputs/delivery.integration.test.ts -t "CA-OUT-11" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 1 test `CA-OUT-11` ejecutado (✓) y 0 saltados; tras `failed`, `retryDelivery` + procesado con el servidor ya en 200 deja `status = sent`, `attempts = 1` (el reenvío reinicia `attempts` a 0 y el intento exitoso lo deja en 1) y 6 filas `DeliveryAttempt` con `number` correlativo 1..6 (el número no se reinicia); reenviar un envío `sent` da `ConflictError`.

### PP-OUT-16 — PDF de una respuesta: contenido, descarga y tope de tamaño

- **Cubre:** CA-OUT-12, CA-OUT-13, RF-OUT-03, RF-OUT-04, RF-OUT-17
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/outputs/pdf-model.test.ts src/server/outputs/submission-pdf.service.test.ts "pdf/route.test.ts" -t "CA-OUT-1[23]" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 4 tests `CA-OUT-12`/`CA-OUT-13` ejecutados (✓) y 0 saltados; el PDF empieza por `%PDF-`, con logo PNG y firma tiene 2 `/Subtype /Image`; una imagen WEBP se sustituye sin lanzar; con un tope pequeño se regenera sin imágenes (`imagesIncluded: false`, 0 imágenes) y por debajo del tope; el handler responde 200 `application/pdf` con `Content-Disposition: attachment`, 401 sin sesión, 403 como collector y 404 de otra organización.

### PP-OUT-17 — Reanudación de envíos pendientes

- **Cubre:** RNF-OUT-06, RF-OUT-09
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/outputs/delivery.integration.test.ts src/server/outputs/delivery-poller.test.ts -t "RNF-OUT-06" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 3 tests `RNF-OUT-06` ejecutados (✓; en `delivery-poller.test.ts`: `startDeliveryPoller` es idempotente, no arranca con `DELIVERY_POLLER_ENABLED=false` y ejecuta un ciclo al arrancar; en la integración: se recoge un `sending` atascado, y no se recogen los pendientes con `nextAttemptAt` futuro ni los `sent`/`failed`) y 0 saltados.

### PP-OUT-18 — Sin datos personales ni secretos en logs

- **Cubre:** RNF-OUT-05
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/outputs/delivery.integration.test.ts -t "RNF-OUT-05" --reporter=verbose
  ```
- **Resultado esperado:** código de salida 0; al menos 1 test `RNF-OUT-05` ejecutado (✓) y 0 saltados; durante un ciclo completo de email y webhook ninguna línea de `console.log/warn/error` contiene destinatario, URL, secreto ni valores de respuestas.

### PP-OUT-19 — Pantalla de destinos y descarga del PDF (HTTP real)

- **Cubre:** CA-OUT-09, CA-OUT-10, CA-OUT-12, RF-OUT-01, RF-OUT-07, RF-OUT-16
- **Tipo:** automático (Playwright)
- **Precondiciones:** datos demo (`db:seed`); el propio spec crea una respuesta con logo y una segunda organización con un administrador. No necesita red externa: `https://example.com/hook` solo pasa la validación de sintaxis y de IP al configurarla, sin resolver DNS ni enviar nada; no marcar `BLOQUEADO` por falta de salida a internet.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx playwright test e2e/outputs-destinations.spec.ts
  ```
- **Resultado esperado:** código de salida 0; guardar el webhook `http://10.0.0.5/hook` muestra «La URL apunta a una dirección privada o no permitida.» y no lo guarda; `https://example.com/hook` se guarda y muestra el secreto `whsec_…` una vez (tras recargar no aparece); un email con dos direcciones persiste tras recargar; el administrador de otra organización recibe 404 en `/admin/forms/<id>/destinations`; «Descargar PDF» en la ficha da 200 `application/pdf` y con la sesión de otra organización 404; la página muestra el aviso sobre datos personales.

## Comprobaciones manuales

- [ ] Abrir el CSV exportado con Excel en español: acentos correctos, columnas separadas, y una celda `=1+1` se ve como texto — Cubre: RNF-OUT-04, CA-OUT-05.
- [ ] Rendimiento de 5 000 respuestas (< 20 s): no se automatiza por falta de datos a esa escala en el runner — Cubre: RNF-OUT-03.
- [ ] Los enlaces de fotos y firmas del Excel se abren con la sesión iniciada solo cuando `file-storage` esté fusionado — Cubre: RF-OUT-06.
- [ ] Abrir en `http://localhost:8025` (Mailpit en local) el PDF de una respuesta y comprobar a ojo logo, colores, fotos, firma y GPS legibles — Cubre: RF-OUT-03, CA-OUT-01.
- [ ] Con un SMTP real (Brevo) y `SMTP_FROM` verificado, el email llega y el PDF se abre en el móvil — Cubre: RNF-OUT-02.
- [ ] Reiniciar la aplicación con envíos pendientes y comprobar que se reanudan — Cubre: RNF-OUT-06 (limitación del piloto: sin proceso vivo no hay reintentos).

## Limpieza

```bash
npm run test:stack:down     # en testPR y module-test lo hace el workflow
```

## Historial de cambios

- 2026-11-26 — Issue #35: PP-OUT-09 a PP-OUT-19 para CA-OUT-01, CA-OUT-03, CA-OUT-07 a CA-OUT-13, RF-OUT-13 y RNF-OUT-05/06; comprobaciones manuales del PDF, SMTP real y reinicio.

- 2026-11-26 — Revisión del arquitecto (#35): `SMTP_HOST` lo añade la PR (precondición en PP-OUT-09); PP-OUT-15 aclara `attempts` y `number`; PP-OUT-19 no usa red externa.
- 2026-11-26 — Plan de pruebas inicial (#28): PP-OUT-01 a PP-OUT-08 para CA-OUT-02, CA-OUT-04, CA-OUT-05, CA-OUT-06 y RF-OUT-11/12; CA-OUT-01 y CA-OUT-03 quedan para el issue de email y webhook.
- 2026-11-26 — Revisión del arquitecto (#28): los casos con `-t` usan `--reporter=verbose` y exigen un mínimo de tests ejecutados y 0 saltados; PP-OUT-06 y PP-OUT-07 filtran por identificador; PP-OUT-03 incluye xlsx y bordes de fórmulas; PP-OUT-07 incluye el test del handler; PP-OUT-08 añade el 404 de formulario inexistente.
