# Almacenamiento de archivos — Plan de pruebas

- **Requisitos:** [README.md](README.md)
- **Diseño:** [design.md](design.md)
- **Responsable:** analyst-programmer (escribe en `design` y lo ejecuta en `testPR`), architect (revisa)
- **Issues:** #25

Este plan se ejecuta en la etapa `testPR`, sobre la rama `issue-25` de la pull request (con la última rama principal fusionada) y **antes de fusionarla**. Todo se ejecuta en el entorno de pruebas en contenedores (ver "Pruebas en contenedores" en `specs/platform/design.md`): cada comando va dentro del contenedor `tests` con `npm run test:stack:run -- <comando>`, y los servicios se llaman por su nombre (`web`, `postgres`, `minio`, `mailpit`), nunca `localhost`. Los casos de integración con MinIO se activan con `STORAGE_INTEGRATION=1`.

## Preparación

```bash
npm run test:stack:up      # imágenes de la rama, servicios, bucket formia, migraciones y app
```

## Comprobaciones generales

| ID | Comando |
| --- | --- |
| PP-STO-G1 | `npm run test:stack:run -- npm run lint` |
| PP-STO-G2 | `npm run test:stack:run -- npm run typecheck` |
| PP-STO-G3 | `npm run test:stack:run -- npm test` |
| PP-STO-G4 | `npm run test:stack:run -- npm run build` |

No hay G5 (Playwright): #25 no tiene interfaz ni toca el recorrido de la demo.

## Casos de prueba

### PP-STO-01 — La URL firmada caduca

- **Cubre:** CA-STO-01, RF-STO-02
- **Tipo:** automático (Vitest, integración con MinIO)
- **Precondiciones:** ninguna además de la preparación.
- **Pasos:**
  ```bash
  npm run test:stack:run -- env STORAGE_INTEGRATION=1 npx vitest run src/server/storage/s3-storage-adapter.integration.test.ts -t "expired"
  ```
- **Resultado esperado:** código de salida 0 y al menos 1 test ejecutado. El test sube un objeto, firma con 1 s de vida, espera 2 s y comprueba que `fetch` de la URL devuelve 403, mientras que antes de caducar devolvía 200. Otro test comprueba que `getSignedUrl` con más de 900 s lanza `Error`.

### PP-STO-02 — Archivo de otra organización: 404

- **Cubre:** CA-STO-02, RF-STO-03
- **Tipo:** automático (Vitest)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/storage/storage.service.test.ts src/app/api/files/route.test.ts -t "otra organización"
  ```
- **Resultado esperado:** código de salida 0 y al menos 2 tests ejecutados: el servicio lanza `NotFoundError` y la ruta `GET` responde 404 cuando la clave pertenece a la organización B y la sesión es de la A; también 404 para una clave inexistente (mismo cuerpo).

### PP-STO-03 — Redirección a URL firmada de ≤ 15 minutos

- **Cubre:** CA-STO-03, RF-STO-09
- **Tipo:** automático (Vitest)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/storage/storage.service.test.ts src/app/api/files/route.test.ts -t "firmada"
  ```
- **Resultado esperado:** código de salida 0 y al menos 2 tests: `GET /api/files?key=...` con sesión de la organización dueña responde 302, `Location` es la URL firmada y `Cache-Control` es `no-store`; `expiresInSeconds` ≤ 900 aunque `STORAGE_SIGNED_URL_TTL_SECONDS` valga 900. Sin sesión, 401.

### PP-STO-04 — Tipo no admitido o tamaño excesivo: se rechaza sin guardar

- **Cubre:** CA-STO-04, RF-STO-04
- **Tipo:** automático (Vitest)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/file-storage/file-type.test.ts src/server/storage/storage.service.test.ts src/app/api/files/route.test.ts -t "rechaza"
  ```
- **Resultado esperado:** código de salida 0 y al menos 5 tests: un `.exe`/texto con extensión `.jpg` → 415; una foto como `signature` (no PNG) → 415; un PDF como `photo` → 415; un archivo de 10 MB + 1 byte → 413; archivo vacío → 400. En todos, el adaptador en memoria no tiene objetos y `StoredFile` no tiene filas.

### PP-STO-05 — Subida idempotente

- **Cubre:** CA-STO-05, RF-STO-06
- **Tipo:** automático (Vitest, con PostgreSQL del entorno)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/storage/storage.service.test.ts src/server/storage/stored-file.repository.test.ts -t "idempot"
  ```
- **Resultado esperado:** código de salida 0 y al menos 4 tests: la misma subida dos veces devuelve la misma clave (`created` true y luego false), hay 1 fila y 1 objeto; dos subidas simultáneas (`Promise.all`) con el mismo `uploadId` dejan 1 fila; dos subidas simultáneas con el mismo `uploadId` y contenido de distinto tipo como `photo` (JPG y PNG, claves distintas) dejan 1 fila y un solo objeto en el adaptador en memoria (se borra el sobrante); el mismo `uploadId` con otro `kind` lanza `ConflictError`.

### PP-STO-06 — Clave y detección de tipo

- **Cubre:** RF-STO-01, RF-STO-04
- **Tipo:** automático (Vitest)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/file-storage
  ```
- **Resultado esperado:** código de salida 0. `buildFileKey` devuelve `org/<org>/<kind>/<uploadId>.<ext>`; `parseFileKey` es su inversa y devuelve `null` para claves mal formadas (incluidas las que contienen `..`); `detectFileType` reconoce JPG, PNG, WEBP, HEIC y PDF por sus bytes y devuelve `null` para el resto.

### PP-STO-07 — El bucket es privado

- **Cubre:** RNF-STO-01
- **Tipo:** automático (Vitest, integración con MinIO)
- **Pasos:**
  ```bash
  npm run test:stack:run -- env STORAGE_INTEGRATION=1 npx vitest run src/server/storage/s3-storage-adapter.integration.test.ts -t "privado"
  ```
- **Resultado esperado:** código de salida 0 y al menos 1 test: tras subir un objeto, un `fetch` a `http://minio:9000/formia/<clave>` sin firma devuelve 403, y con la URL firmada devuelve 200 con el mismo contenido.

### PP-STO-08 — Huérfanos

- **Cubre:** RF-STO-07 (criterio), RF-STO-11
- **Tipo:** automático (Vitest, con PostgreSQL)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/storage/stored-file.repository.test.ts -t "huérfan"
  ```
- **Resultado esperado:** código de salida 0 y al menos 3 tests: `findOrphanFiles(cutoff)` devuelve los archivos sin `submissionId` anteriores a `cutoff`, no devuelve los vinculados con `linkToSubmission` ni los recientes; `linkToSubmission` no modifica archivos de otra organización (devuelve 0).

### PP-STO-09 — Configuración solo por variables de entorno y logs sin contenido

- **Cubre:** RNF-STO-03, RNF-STO-04
- **Tipo:** automático (Vitest)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/env.test.ts src/server/storage/storage.service.test.ts -t "STORAGE|S3_PUBLIC|log"
  ```
- **Resultado esperado:** código de salida 0 y al menos 3 tests: `STORAGE_SIGNED_URL_TTL_SECONDS=901` es inválido; `STORAGE_MAX_UPLOAD_BYTES` por defecto es 10485760; `S3_PUBLIC_ENDPOINT` es opcional; tras una subida, el log solo contiene `key` y `sizeBytes` (no bytes ni nombre de archivo).

### PP-STO-10 — Subida y lectura contra la aplicación y MinIO reales

- **Cubre:** CA-STO-03, CA-STO-04, CA-STO-05 (de extremo a extremo en la capa de servicio)
- **Tipo:** automático (Vitest, integración con PostgreSQL y MinIO)
- **Pasos:**
  ```bash
  npm run test:stack:run -- env STORAGE_INTEGRATION=1 npx vitest run src/server/storage/storage.integration.test.ts
  ```
- **Resultado esperado:** código de salida 0. Con adaptador S3 real: subir un PNG, subirlo de nuevo (1 objeto en el bucket, 1 fila), pedir la URL firmada y descargarla (los bytes coinciden), rechazar un fichero de texto (el bucket no cambia). El test borra sus objetos y filas al terminar.

## Comprobaciones manuales

- [ ] Al desplegar con `S3_PUBLIC_ENDPOINT` apuntando al host público del almacenamiento, la redirección de `GET /api/files` abre la imagen en un navegador (no se puede comprobar desde el contenedor de pruebas) — Cubre: CA-STO-03.

## Limpieza

```bash
npm run test:stack:down     # en testPR y module-test lo hace el workflow
```

## Historial de cambios

- 2026-11-26 — PP-STO-05: caso de carrera con distinto tipo (revisión del arquitecto) (#25)
- 2026-11-26 — Plan de pruebas inicial (#25)
