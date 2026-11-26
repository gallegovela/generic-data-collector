# Publicación y versiones — Plan de pruebas

- **Requisitos:** [README.md](README.md)
- **Diseño:** [design.md](design.md)
- **Responsable:** analyst-programmer (escribe en `design` y lo ejecuta en `testPR`), architect (revisa)
- **Issues:** #26

Este plan se ejecuta en la etapa `testPR`, sobre la rama `issue-26` de la pull request (con la última rama principal fusionada) y **antes de fusionarla**. Todo se ejecuta en el entorno de pruebas en contenedores (ver "Pruebas en contenedores" en `specs/platform/design.md`): cada comando va dentro del contenedor `tests` con `npm run test:stack:run -- <comando>`, y los servicios se llaman por su nombre (`web`, `postgres`), nunca `localhost`. Este módulo necesita PostgreSQL y la app; no usa MinIO ni Mailpit.

Convención: cada test cuyo título contiene el identificador del criterio (`CA-PUB-0N`) se selecciona con `-t "CA-PUB-0N"` (Vitest) o `-g "CA-PUB-0N"` (Playwright). «Pasan» significa: código de salida 0, al menos un test seleccionado y ninguno fallido ni omitido.

## Preparación

```bash
npm run test:stack:up                            # imágenes de la rama, servicios, migraciones y app
npm run test:stack:run -- npm run db:seed        # usuario admin y organización demo
```

## Comprobaciones generales

| ID | Comando |
| --- | --- |
| PP-PUB-G1 | `npm run test:stack:run -- npm run lint` |
| PP-PUB-G2 | `npm run test:stack:run -- npm run typecheck` |
| PP-PUB-G3 | `npm run test:stack:run -- npm test` |
| PP-PUB-G4 | `npm run test:stack:run -- npm run build` |
| PP-PUB-G5 | `npm run test:stack:run -- npx playwright test` (el cambio toca el editor, que forma parte del recorrido de la demo) |

## Casos de prueba

### PP-PUB-01 — Republicar crea v2 y las respuestas antiguas conservan v1

- **Cubre:** CA-PUB-01, RF-PUB-01, RF-PUB-02
- **Tipo:** automático (Vitest, con PostgreSQL)
- **Precondiciones:** migraciones aplicadas.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/form-publishing/form-publishing.service.test.ts -t "CA-PUB-01"
  ```
- **Resultado esperado:** los tests pasan. Tras publicar, cambiar una etiqueta del borrador y publicar de nuevo, existen las versiones 1 y 2; `getFormVersion(<id v1>)` devuelve la etiqueta antigua y la v2 la nueva; mientras no se republica, la versión servida sigue siendo la anterior.

### PP-PUB-02 — QR en PNG y SVG que codifica el enlace

- **Cubre:** CA-PUB-02, RF-PUB-04, RF-PUB-05
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/form-publishing/qr.test.ts src/lib/form-publishing/form-link.test.ts -t "CA-PUB-02"
  npm run test:stack:run -- npx playwright test e2e/form-publishing-panel.spec.ts -g "CA-PUB-02"
  ```
- **Resultado esperado:** los tests pasan. El PNG empieza por la firma `89 50 4E 47`, el SVG por `<svg`, el enlace es `<AUTH_URL>/f/<slug>`; en el navegador, `/api/forms/<id>/qr?format=png` responde 200 `image/png` y `?format=svg` 200 `image/svg+xml`, el panel muestra el QR y abrir `/f/<slug>` muestra el formulario (`fill-placeholder`).

### PP-PUB-03 — Las respuestas de v1 siguen válidas tras una v2 con un campo obligatorio nuevo

- **Cubre:** CA-PUB-03, RF-PUB-03, RF-PUB-08
- **Tipo:** automático (Vitest, con PostgreSQL)
- **Precondiciones:** migraciones aplicadas.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/form-publishing/form-publishing.service.test.ts -t "CA-PUB-03"
  ```
- **Resultado esperado:** los tests pasan. Con v2 publicada (campo obligatorio nuevo), `getFormVersion(<id v1>)` no contiene ese campo y una respuesta de ejemplo de v1 pasa `validateSubmission` contra el esquema de v1; el mismo `slug` sirve v2.

### PP-PUB-04 — Control de acceso por modo (`registered` / `public`)

- **Cubre:** CA-PUB-04, RF-PUB-09
- **Tipo:** automático (Vitest + Playwright con peticiones HTTP)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/form-publishing/access.test.ts src/server/form-publishing/form-publishing.service.test.ts -t "CA-PUB-04"
  npm run test:stack:run -- npx playwright test e2e/form-publishing-api.spec.ts -g "CA-PUB-04"
  ```
- **Resultado esperado:** los tests pasan. `GET http://web:3000/api/public/forms/<slug>` sin cookies: 401 (`{"error":"login-required"}`) en modo `registered` y 200 con `schema` en modo `public`; con la sesión del admin de la misma organización: 200 en modo `registered`; el modo por defecto al publicar es `registered`; cambiar el modo no crea una versión nueva.

### PP-PUB-05 — Aislamiento entre organizaciones

- **Cubre:** CA-PUB-05, RNF-PUB-02
- **Tipo:** automático (Vitest con PostgreSQL + Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/form-publishing/form-publishing.repository.test.ts src/server/form-publishing/form-publishing.service.test.ts -t "CA-PUB-05"
  npm run test:stack:run -- npx playwright test e2e/form-publishing-api.spec.ts -g "CA-PUB-05"
  ```
- **Resultado esperado:** los tests pasan. Con el `organizationId` de B: publicar, despublicar, cambiar el modo y leer versiones de un formulario de A lanzan `NotFoundError` (servicio) o devuelven `null` (repositorio) y no modifican nada; `GET /api/forms/<idDeA>/qr` con la sesión de un admin de B responde 404.

### PP-PUB-06 — Despublicar cierra el enlace y republicar lo reabre

- **Cubre:** CA-PUB-06, RF-PUB-06, RF-PUB-10
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/form-publishing/form-publishing.service.test.ts -t "CA-PUB-06"
  npm run test:stack:run -- npx playwright test e2e/form-publishing-panel.spec.ts e2e/form-publishing-api.spec.ts -g "CA-PUB-06"
  ```
- **Resultado esperado:** los tests pasan. Despublicado, `getPublishedFormBySlug` devuelve `{ state: "closed" }`, la API responde 410 con `"Este formulario ya no acepta respuestas."` y `/f/<slug>` muestra "Este formulario ya no acepta respuestas"; al republicar el `slug` es el mismo y `version` es 2. Un formulario archivado también queda cerrado.

### PP-PUB-07 — Un borrador no válido no se publica

- **Cubre:** CA-PUB-07, RF-PUB-11
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/form-publishing/form-publishing.service.test.ts -t "CA-PUB-07"
  npm run test:stack:run -- npx playwright test e2e/form-publishing-panel.spec.ts -g "CA-PUB-07"
  ```
- **Resultado esperado:** los tests pasan. Publicar un borrador sin campos lanza `PublishValidationError` con el mensaje "El formulario necesita al menos un campo para publicarse.", no se crea ninguna `FormVersion` ni cambia `status`/`slug`; en el panel se ve el mensaje y no aparece el enlace.

### PP-PUB-08 — Las versiones son inmutables y el slug no es adivinable

- **Cubre:** RF-PUB-01, RNF-PUB-01
- **Tipo:** automático (Vitest)
- **Precondiciones:** migraciones aplicadas.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/form-publishing/slug.test.ts src/server/form-publishing/form-publishing.repository.test.ts
  ```
- **Resultado esperado:** los tests pasan: slugs de 10 caracteres del alfabeto permitido y sin repetirse en 1000 generaciones; el módulo del repositorio no exporta ninguna función que actualice o borre `FormVersion`; la columna `version` crece 1, 2, 3; un choque de `(formId, version)` produce `ConflictError`; dos `createVersionAndPublish` seguidos con slugs distintos dejan el primero.

### PP-PUB-09 — La migración es compatible con los formularios existentes y el listado muestra la versión

- **Cubre:** RNF-PUB-03, RF-PUB-01
- **Tipo:** comando + automático (Vitest)
- **Precondiciones:** seed aplicado (crea formularios sin publicar).
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx prisma migrate status
  npm run test:stack:run -- npx vitest run src/server/forms/form.repository.test.ts
  ```
- **Resultado esperado:** `migrate status` termina con código 0 y contiene "Database schema is up to date"; el segundo comando pasa (etiquetas "Sin publicar", "v<n>" y "Despublicado (última v<n>)").

## Comprobaciones manuales

- [ ] Escanear con un móvil real el QR descargado (PNG y SVG) y comprobar que abre el formulario. — Cubre: CA-PUB-02
- [ ] El panel de publicar se ve ordenado en pantalla de ordenador y no rompe la barra superior del editor en una ventana estrecha. — Cubre: RF-PUB-05, RF-PUB-09
- [ ] "Copiar enlace" copia al portapapeles el enlace mostrado. — Cubre: RF-PUB-04

## Limpieza

```bash
npm run test:stack:down     # en testPR y module-test lo hace el workflow
```

## Historial de cambios

- 2026-11-26 — Plan de pruebas inicial (#26)
