# Salidas de datos — Plan de pruebas

- **Requisitos:** [README.md](README.md)
- **Diseño:** [design.md](design.md)
- **Responsable:** analyst-programmer (escribe en `design` y lo ejecuta en `testPR`), architect (revisa)
- **Issues:** #28 (exportación a CSV y Excel)

Este plan se ejecuta en la etapa `testPR`, sobre la rama `issue-<n>` de la pull request (con la última rama principal fusionada) y **antes de fusionarla**. Todo se ejecuta en el entorno de pruebas en contenedores (ver "Pruebas en contenedores" en `specs/platform/design.md`): cada comando va dentro del contenedor `tests` con `npm run test:stack:run -- <comando>`, y los servicios se llaman por su nombre (`web`, `postgres`, `minio`, `mailpit`), nunca `localhost`. Cubre solo el alcance de #28 (exportación a CSV y Excel): los casos del email con PDF, destinos y webhook (CA-OUT-01 y CA-OUT-03) se añadirán con su propio issue. Los casos de `-t "<texto>"` esperan que el programador ponga ese texto (el identificador del criterio, p. ej. `CA-OUT-04`) en el nombre del test.

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
  npm run test:stack:run -- npx vitest run src/server/outputs/xlsx.test.ts src/server/outputs/export.service.test.ts -t "CA-OUT-02"
  ```
- **Resultado esperado:** código de salida 0; el `.xlsx` generado, leído con exceljs, tiene 1 fila de cabecera y 3 de datos; un campo numérico queda como celda numérica.

### PP-OUT-02 — Unión de versiones

- **Cubre:** CA-OUT-04, RF-OUT-06
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/outputs/export-table.test.ts -t "CA-OUT-04"
  ```
- **Resultado esperado:** código de salida 0; con respuestas v1 y v2 (v2 con campo nuevo) hay una columna por campo, una sola para los campos comunes, la columna nueva vacía en las filas v1, la cabecera usa la etiqueta de la v2 y existe la columna "Versión".

### PP-OUT-03 — Neutralización de fórmulas

- **Cubre:** CA-OUT-05, RF-OUT-12
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/lib/outputs/cell-safety.test.ts src/lib/outputs/format-cell.test.ts src/lib/outputs/csv.test.ts -t "CA-OUT-05"
  ```
- **Resultado esperado:** código de salida 0; un valor `=1+1` sale como `'=1+1` en la celda y en el CSV; lo mismo para `+`, `-` y `@` iniciales; un número negativo y unas coordenadas negativas no se alteran.

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
  npm run test:stack:run -- npx vitest run src/server/outputs/export.service.test.ts src/server/submissions/submission.repository.test.ts -t "organizacion|CA-OUT-06"
  ```
- **Resultado esperado:** código de salida 0; `exportSubmissions(orgB, formIdDeA, ...)` lanza `NotFoundError`; `listSubmissionsForExport(orgB, ...)` devuelve `[]` y `countSubmissionsOfForm(orgB, ...)` devuelve 0.

### PP-OUT-07 — Lo exportado coincide con el listado y límite de filas

- **Cubre:** RF-OUT-11, RNF-OUT-03
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/outputs/export.service.test.ts -t "listado|limite"
  ```
- **Resultado esperado:** código de salida 0; con filtros de fecha, usuario, campo y texto, el nº de filas exportadas es igual a `total` de `listSubmissionsByForm`; superar `EXPORT_MAX_ROWS` lanza `ValidationError`.

### PP-OUT-08 — Descarga HTTP real (permisos y 404)

- **Cubre:** CA-OUT-02, CA-OUT-04, CA-OUT-05, CA-OUT-06
- **Tipo:** automático (Playwright)
- **Precondiciones:** datos demo (`db:seed`); el propio spec crea sus respuestas v1/v2 y una segunda organización con un administrador.
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx playwright test e2e/outputs-export.spec.ts
  ```
- **Resultado esperado:** código de salida 0; con sesión admin, `GET /api/forms/<id>/submissions/export?format=csv` devuelve 200, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition` con `attachment` y el cuerpo empieza por BOM; `format=xlsx` devuelve 200 con el tipo MIME de xlsx; sin sesión 401; con rol `collector` 403; con un administrador de otra organización 404; `format=pdf` o sin `format` 400; la página del listado muestra los enlaces "Exportar a Excel" y "Exportar a CSV" con los filtros activos en el `href`.

## Comprobaciones manuales

- [ ] Abrir el CSV exportado con Excel en español: acentos correctos, columnas separadas, y una celda `=1+1` se ve como texto — Cubre: RNF-OUT-04, CA-OUT-05.
- [ ] Rendimiento de 5 000 respuestas (< 20 s): no se automatiza por falta de datos a esa escala en el runner — Cubre: RNF-OUT-03.
- [ ] Los enlaces de fotos y firmas del Excel se abren con la sesión iniciada solo cuando `file-storage` esté fusionado — Cubre: RF-OUT-06.

## Limpieza

```bash
npm run test:stack:down     # en testPR y module-test lo hace el workflow
```

## Historial de cambios

- 2026-11-26 — Plan de pruebas inicial (#28): PP-OUT-01 a PP-OUT-08 para CA-OUT-02, CA-OUT-04, CA-OUT-05, CA-OUT-06 y RF-OUT-11/12; CA-OUT-01 y CA-OUT-03 quedan para el issue de email y webhook.
