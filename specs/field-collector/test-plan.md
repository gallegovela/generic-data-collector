# Recogida en campo (PWA) — Plan de pruebas

- **Requisitos:** [README.md](README.md)
- **Diseño:** [design.md](design.md)
- **Responsable:** analyst-programmer (escribe en `design` y lo ejecuta en `testPR`), architect (revisa)
- **Issues:** #33

Este plan se ejecuta en la etapa `testPR`, sobre la rama `issue-33` de la pull request (con la última rama principal fusionada) y **antes de fusionarla**. Todo se ejecuta en el entorno de pruebas en contenedores (ver "Pruebas en contenedores" en `specs/platform/design.md`): cada comando va dentro del contenedor `tests` con `npm run test:stack:run -- <comando>`, y los servicios se llaman por su nombre (`web`, `postgres`, `minio`, `mailpit`), nunca `localhost`. Este módulo necesita PostgreSQL, MinIO y la app.

Convención: cada test cuyo título contiene el identificador del criterio (`CA-COL-0N`) se selecciona con `-t "CA-COL-0N"` (Vitest) o `-g "CA-COL-0N"` (Playwright). «Pasan» significa: código de salida 0, al menos un test seleccionado y ninguno fallido ni omitido. Este plan cubre solo el relleno en línea (#33); los criterios sin conexión (CA-COL-01) se probarán con su pieza.

## Preparación

```bash
npm run test:stack:up                            # imágenes de la rama, servicios, bucket, migraciones y app
npm run test:stack:run -- npm run db:seed        # organización demo, admin y formularios de ejemplo
```

## Comprobaciones generales

| ID | Comando |
| --- | --- |
| PP-COL-G1 | `npm run test:stack:run -- npm run lint` |
| PP-COL-G2 | `npm run test:stack:run -- npm run typecheck` |
| PP-COL-G3 | `npm run test:stack:run -- npm test` |
| PP-COL-G4 | `npm run test:stack:run -- npm run build` |
| PP-COL-G5 | `npm run test:stack:run -- npx playwright test` (el cambio toca `/f/<slug>`, parte del recorrido de la demo) |

## Casos de prueba

### PP-COL-01 — Lógica condicional en tiempo real

- **Cubre:** CA-COL-03, RF-COL-02
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/field-collector/answers.test.ts -t "CA-COL-03"
  npm run test:stack:run -- npx playwright test e2e/field-collector-fill.spec.ts -g "CA-COL-03"
  ```
- **Resultado esperado:** los tests pasan. Con «¿Hay incidencias?» = sí aparece el campo condicional; al responder no desaparece del DOM y Guardar no exige su valor (la respuesta guardada no contiene su clave).

### PP-COL-02 — Reenviar con el mismo `clientId` no duplica

- **Cubre:** CA-COL-02, RF-COL-08
- **Tipo:** automático (Vitest con PostgreSQL)
- **Precondiciones:** migraciones aplicadas.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/field-collector/fill.service.test.ts -t "CA-COL-02"
  ```
- **Resultado esperado:** los tests pasan. Dos `submitFill` con el mismo `clientId` devuelven el mismo `id` (`created: true` y luego `false`) y existe una sola `Submission`; el endpoint responde 201 y después 200.

### PP-COL-03 — Rellenar con foto y firma y guardar

- **Cubre:** CA-COL-04, RF-COL-09, RF-COL-10, RF-COL-11, RF-COL-13, RF-COL-18, RF-COL-20
- **Tipo:** automático (Vitest con PostgreSQL y MinIO + Playwright)
- **Precondiciones:** seed aplicado; formulario publicado por el propio test con todos los tipos de campo.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/field-collector/fill.service.test.ts -t "CA-COL-04"
  npm run test:stack:run -- npx playwright test e2e/field-collector-fill.spec.ts -g "CA-COL-04"
  ```
- **Resultado esperado:** los tests pasan. Tras Guardar existe una `Submission` con `formVersionId` de la versión publicada y `capturedAt` informado; el JSONB de las fotos y la firma contiene solo `key` (sin URL); los `StoredFile` de esas claves tienen `submissionId` igual al de la respuesta; en la ficha del panel `/admin/forms/<id>/submissions/<submissionId>` las imágenes cargan por URL firmada (`img` con `naturalWidth > 0`); se muestra `save-success`.

### PP-COL-04 — Descartar no guarda

- **Cubre:** CA-COL-05, RF-COL-15
- **Tipo:** automático (Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx playwright test e2e/field-collector-fill.spec.ts -g "CA-COL-05"
  ```
- **Resultado esperado:** el test pasa. Con algo escrito, Descartar abre `discard-confirm`; al confirmar se vuelve al listado y el número de `Submission` del formulario no cambia; sin nada escrito, Descartar sale sin diálogo; cancelar el diálogo conserva lo escrito.

### PP-COL-05 — Acceso `registered`

- **Cubre:** CA-COL-06, RF-COL-17
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** seed aplicado; formulario `registered` publicado; usuario de otra organización creado por el test.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/field-collector/fill.service.test.ts -t "CA-COL-06"
  npm run test:stack:run -- npx playwright test e2e/field-collector-access.spec.ts -g "CA-COL-06"
  ```
- **Resultado esperado:** los tests pasan. Sin sesión `/f/<slug>` redirige a `/login`; con sesión de otra organización se ve `access-forbidden` («No tienes acceso»); `POST /api/public/forms/<slug>/files` y `/submissions` responden 401 sin sesión y 403 con la de otra organización, y no se crea ninguna `Submission` ni `StoredFile`.

### PP-COL-06 — Acceso `public` anónimo y aislamiento por organización

- **Cubre:** CA-COL-07, RF-COL-17, RF-COL-18
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** seed aplicado; formulario `public` publicado en la organización A; organización B creada por el test.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/field-collector/fill.service.test.ts -t "CA-COL-07"
  npm run test:stack:run -- npx playwright test e2e/field-collector-access.spec.ts -g "CA-COL-07"
  ```
- **Resultado esperado:** los tests pasan. Sin sesión se rellena y guarda, se muestra `/f/<slug>/thanks`; la `Submission` tiene `organizationId` de A, `submittedByUserId` y `submittedByName` nulos; un `organizationId` o una clave de archivo de B incluidos en el cuerpo se ignoran/rechazan (400) y nada se escribe en B; el mismo `uploadId` usado en otra organización no sobrescribe el archivo.

### PP-COL-07 — Formulario despublicado

- **Cubre:** CA-COL-08, RF-COL-17
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** formulario publicado y después despublicado por el test.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/field-collector/fill.service.test.ts -t "CA-COL-08"
  npm run test:stack:run -- npx playwright test e2e/field-collector-access.spec.ts -g "CA-COL-08"
  ```
- **Resultado esperado:** los tests pasan. `/f/<slug>` muestra `form-closed`; subida y guardado responden 410 y no crean nada; una respuesta rellenada con v1 mientras se publica v2 se guarda con `formVersionNumber` 1 (validada contra v1).

### PP-COL-08 — Campo obligatorio vacío

- **Cubre:** CA-COL-09, RF-COL-03, RF-COL-11
- **Tipo:** automático (Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx playwright test e2e/field-collector-fill.spec.ts -g "CA-COL-09"
  ```
- **Resultado esperado:** el test pasa. Con un obligatorio vacío, Guardar muestra `field-error-<id>` con texto en español junto al campo, no se hace ninguna petición `POST` a `/submissions` (comprobado con `page.route`) y no se crea `Submission`; con GPS obligatorio y permiso denegado (contexto sin permisos) se muestra el mensaje de permiso denegado y no se guarda.

### PP-COL-09 — Límites contra abuso en modo público

- **Cubre:** CA-COL-10, RF-COL-19, RNF-COL-05
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** formulario `public` publicado.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/field-collector/fill-rate-limit.test.ts src/server/field-collector/fill.service.test.ts -t "CA-COL-10"
  npm run test:stack:run -- npx playwright test e2e/field-collector-access.spec.ts -g "CA-COL-10"
  ```
- **Resultado esperado:** los tests pasan. Tras superar `FILL_RATE_LIMITS.submit.limit` guardados desde la misma IP el siguiente responde 429 con cabecera `Retry-After`; lo mismo con la subida; otro formulario u otra IP no quedan bloqueados; con `website` relleno el endpoint responde 201 y no hay `Submission` nueva; `GET /api/public/forms/<slug>/files` responde 405; un `kind: "document"` en la subida responde 400, un fichero no imagen 415 y uno de más de 10 MB 413; la salida de la consola del servidor no contiene las respuestas ni la IP.

### PP-COL-10 — Renderizado de todos los tipos de campo y reintento sin duplicar

- **Cubre:** RF-COL-02, RF-COL-08, RF-COL-16
- **Tipo:** automático (Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx playwright test e2e/field-collector-fill.spec.ts -g "all field types"
  npm run test:stack:run -- npx playwright test e2e/field-collector-fill.spec.ts -g "retry"
  ```
- **Resultado esperado:** los tests pasan. Un formulario con los 12 tipos se renderiza y se rellena; con la primera petición de guardar abortada (`route.abort()`) aparece «No se pudo enviar. Reintentar», y tras reintentar existe una sola `Submission` (mismo `clientId`).

## Comprobaciones manuales

- [ ] Abrir `/f/<slug>` en un móvil real (o emulación de 360 px) y comprobar que se usa con una mano, que el teclado virtual no tapa el campo activo ni los botones, y que el aspecto es agradable. — Cubre: RNF-COL-02
- [ ] En un móvil real, comprobar que la foto abre la cámara o la galería según `allowGallery`, que la firma con el dedo es fluida y que el permiso de GPS se solicita. — Cubre: RF-COL-09, RF-COL-10, RF-COL-11
- [ ] Escanear el QR de un formulario publicado y comprobar que abre la pantalla de relleno. — Cubre: RF-COL-01

## Limpieza

```bash
npm run test:stack:down     # en testPR y module-test lo hace el workflow
```

## Historial de cambios

- 2026-11-26 — Plan de pruebas inicial: relleno en línea (#33)
