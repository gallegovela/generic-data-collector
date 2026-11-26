# Salidas de datos — Diseño técnico

- **Requisitos:** [README.md](README.md)
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #28 (exportación a CSV y Excel), padre #23

## Resumen

El issue #28 construye solo la **exportación de respuestas a `.xlsx` y CSV** de un formulario. El email con PDF, los destinos y el webhook (RF-OUT-01 a 04, 07 a 10) quedan para un issue posterior.

Decisiones:

1. **Mismo filtrado que el listado.** El exportador reutiliza la lógica de filtros de `submissions-dashboard`: se extrae de `listSubmissionsByForm` un `buildSubmissionWhere` (repositorio) y de `listSubmissions` un `toListFilters` (servicio), y los dos caminos los usan. Así lo exportado coincide con lo que se ve y siempre lleva `organizationId` (RF-OUT-11).
2. **Un único fichero, sin streaming ni colas.** Se leen las filas (máx. 10 000), se construye una tabla en memoria (`ExportTable`) y se serializa. Lo bueno: lógica pura y testeable (la tabla) separada de los formatos (CSV, xlsx). Para 5 000 filas basta (RNF-OUT-03).
3. **Columnas por `id` de campo, unión de versiones** (RF-OUT-06). Cada fila se formatea con la definición de campo de **su propio** `formVersionSnapshot`; la cabecera usa la etiqueta de la versión más reciente en que aparece el campo.
4. **Número de versión.** `Submission` no guarda hoy el número de versión (el `FormVersion` de `form-schema` no lo tiene). Se añade `Submission.formVersionNumber Int?` (nulo hasta que `form-publishing` lo rellene en la recepción real). La columna "Versión" sale vacía si es nulo. La lógica de unión NO depende de este número.
5. **Fotos y firmas = enlace autenticado.** `buildFileExportLink(baseUrl, file)` aislada; trata `file.key` como opaco. Se sustituirá/ajustará cuando exista `file-storage`.
6. **Antiinyección de fórmulas** en una función pura aplicada a toda celda de texto, en CSV y xlsx.
7. **Dependencia nueva de npm:** `exceljs` (ya prevista en el stack de CLAUDE.md, aún no instalada).

## Modelo de datos

```prisma
// prisma/schema.prisma — se modifica el modelo Submission (#7)
model Submission {
  // ...campos existentes sin cambios...
  formVersionNumber Int? // número de versión publicada con la que se rellenó; nulo si aún no se conoce
}
```

Migración: `add_submission_version_number` (`npx prisma migrate dev --name add_submission_version_number`). Sin índices nuevos. `createSubmissionFixture` acepta `formVersionNumber?: number`.

## Estructura de ficheros

| Capa | Ruta | Responsabilidad |
| --- | --- | --- |
| Modelo | `prisma/schema.prisma` (modificar) | `formVersionNumber` en `Submission`. |
| Validación | `src/lib/outputs/export-query.schema.ts` | `submissionExportQuerySchema`: formato + los mismos filtros del listado, sin `page`. |
| Lógica pura | `src/lib/outputs/cell-safety.ts` | `neutralizeFormula(text)`. |
| Lógica pura | `src/lib/outputs/format-cell.ts` | `formatExportCell(field, value, buildFileLink)`: formato de cada tipo de campo. |
| Lógica pura | `src/lib/outputs/file-link.ts` | `buildFileExportLink(baseUrl, file)`. |
| Lógica pura | `src/lib/outputs/export-table.ts` | `buildExportTable(rows, options)`: columnas (unión de versiones) y filas. |
| Lógica pura | `src/lib/outputs/csv.ts` | `serializeCsv(table)`: UTF-8 con BOM, separador `;`. |
| Lógica pura | `src/lib/outputs/export-href.ts` | `buildExportHref(formId, query, format)`: URL de descarga con los filtros activos. |
| Servidor | `src/server/outputs/xlsx.ts` | `serializeXlsx(table)` con exceljs. |
| Repositorio | `src/server/submissions/submission.repository.ts` (modificar) | Extrae `buildSubmissionWhere`; añade `countSubmissionsOfForm` y `listSubmissionsForExport`. |
| Servicio | `src/server/submissions/submission.service.ts` (modificar) | Extrae `toListFilters` (usado por `listSubmissions` y por el exportador). |
| Servicio | `src/server/outputs/export.service.ts` | `exportSubmissions(...)`. |
| Entrada | `src/app/api/forms/[id]/submissions/export/route.ts` | `GET` de descarga, solo `admin`. |
| Interfaz | `src/components/outputs/export-buttons.tsx` | Dos enlaces "Exportar a Excel" / "Exportar a CSV" con los filtros activos. |
| Interfaz | `src/app/admin/forms/[id]/submissions/page.tsx` (modificar) | Pinta `<ExportButtons />` si `result.total > 0`. |
| Datos de prueba | `prisma/fixtures/submissions-dashboard.fixtures.ts` (modificar) | `buildDailyReportFormVersionV2()`: igual que la v1 más un campo de texto nuevo `weather` ("Tiempo"). |
| Tests | `e2e/helpers/submissions-dashboard.ts` (modificar) | `addSubmission` acepta `formVersion`/`formVersionNumber` opcionales. |

**Dependencia nueva de npm** (a confirmar): `exceljs` (dependencies).

## Contratos

```ts
// src/lib/outputs/export-query.schema.ts
import { z } from "zod";
import { submissionFiltersSchema } from "@/lib/submissions-dashboard/submission-filters.schema";

export const EXPORT_FORMATS = ["xlsx", "csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const EXPORT_MAX_ROWS = 10_000;

export const submissionExportQuerySchema = submissionFiltersSchema
  .omit({ page: true })
  .extend({ format: z.enum(EXPORT_FORMATS) });
export type SubmissionExportQuery = z.infer<typeof submissionExportQuerySchema>;
```

```ts
// src/lib/outputs/cell-safety.ts
/** Si `text` empieza por "=", "+", "-" o "@" (o tabulador / retorno de carro), antepone "'".
 *  Excepción: una cadena puramente numérica o de coordenadas (/^[+-]?\d+(\.\d+)?(, [+-]?\d+(\.\d+)?)?$/)
 *  se devuelve intacta (no puede ser una fórmula). Por tanto "+34600123456" queda intacto (aceptado),
 *  mientras que "-1+1", "=SUMA(A1)", "\t=1" y "\r=1" se prefijan. Cubre: RF-OUT-12 */
export function neutralizeFormula(text: string): string;
```

```ts
// src/lib/outputs/file-link.ts
import type { FileRef } from "@/lib/form-schema";
// TODO(file-storage, RF-STO-02): ajustar a la ruta real autenticada cuando exista el módulo.
/** `${baseUrl}/api/files/${encodeURIComponent(file.key)}`; sin barra final en baseUrl. */
export function buildFileExportLink(baseUrl: string, file: FileRef): string;
```

```ts
// src/lib/outputs/format-cell.ts
import type { Field, FileRef } from "@/lib/form-schema";

export type ExportCell = string | number | null; // null = celda vacía

/** Sin E/S. `value` es answers[field.id]. Devuelve null si value es undefined/null (o lista vacía).
 *  - text, date, datetime, time -> String(value)
 *  - number -> number (se escribe como número en xlsx y como texto en CSV)
 *  - single_choice -> label de la opción (si no existe, el id crudo)
 *  - multiple_choice -> labels unidas con ", "
 *  - yes_no -> "Sí" / "No"
 *  - photo -> enlaces de buildFileLink unidos con "\n"
 *  - signature -> buildFileLink(file)
 *  - gps -> `${lat}, ${lng}`
 *  - section -> null
 *  Las cadenas resultantes pasan por neutralizeFormula (nunca los number). Cubre: RF-OUT-06, RF-OUT-12 */
export function formatExportCell(
  field: Field,
  value: unknown,
  buildFileLink: (file: FileRef) => string,
): ExportCell;
```

```ts
// src/lib/outputs/export-table.ts
import type { FileRef } from "@/lib/form-schema";
import type { ExportCell } from "./format-cell";

export type ExportSourceRow = {
  capturedAt: Date;
  syncedAt: Date;
  submittedByName: string | null;
  formVersionNumber: number | null;
  formVersionSnapshot: unknown; // se valida con FormVersionSchema.safeParse; si falla, la fila solo aporta sus metadatos
  answers: Record<string, unknown>;
};

export type ExportTable = { headers: string[]; rows: ExportCell[][] };

/** `rows` llega ordenado como el listado (capturedAt desc). Columnas, en este orden:
 *   1. "Fecha de captura" (ISO 8601, toISOString), 2. "Fecha de sincronización" (ISO),
 *   3. "Enviado por", 4. "Versión" (formVersionNumber, number o null),
 *   5... un campo por cada `id` distinto (sin `section`) en la unión de snapshots:
 *      orden = el de la versión de la primera fila (la más reciente); los campos que ya no
 *      existen en ella se añaden detrás, en orden de aparición recorriendo filas;
 *      cabecera = label del campo en la primera fila (la más reciente) cuyo snapshot lo contiene.
 *  Cada celda de campo se formatea con el `Field` del snapshot de su propia fila; vacía (null) si
 *  esa versión no tiene el campo. "Enviado por" también pasa por neutralizeFormula.
 *  Sin filas -> solo las 4 columnas fijas. Cubre: RF-OUT-06, CA-OUT-02, CA-OUT-04, CA-OUT-05 */
export function buildExportTable(
  rows: ExportSourceRow[],
  options: { buildFileLink: (file: FileRef) => string },
): ExportTable;
```

```ts
// src/lib/outputs/csv.ts
/** "﻿" + líneas unidas por "\r\n"; separador ";". Cada celda: null -> ""; number -> String;
 *  string -> entre comillas dobles (con "" para escapar) si contiene ";", comillas, \r o \n. Cubre: RNF-OUT-04 */
export function serializeCsv(table: ExportTable): string;
```

```ts
// src/lib/outputs/export-href.ts
/** `/api/forms/${formId}/submissions/export?format=...` + los filtros no vacíos de `query`
 *  (dateFrom, dateTo, submittedBy, fieldId, fieldValue, q), sin `page`. */
export function buildExportHref(
  formId: string,
  query: Record<string, string | undefined>,
  format: ExportFormat,
): string;
```

```ts
// src/server/outputs/xlsx.ts
/** Hoja "Respuestas"; fila 1 = cabeceras en negrita y congelada; los number como número.
 *  Las cadenas se escriben SIEMPRE como valor de texto, nunca como `{ formula }` de exceljs.
 *  Devuelve el contenido del .xlsx. Cubre: RF-OUT-05, CA-OUT-02 */
export function serializeXlsx(table: ExportTable): Promise<Buffer>;
```

```ts
// src/server/submissions/submission.repository.ts (modificaciones)
export type SubmissionExportFilters = Omit<SubmissionListFilters, "page">;

/** Extraído de listSubmissionsByForm sin cambiar su comportamiento:
 *  { organizationId, formId } + fechas, submittedBy, fieldFilter, textQuery.
 *  Devuelve null si textQuery no encuentra ningún id (resultado vacío seguro). */
async function buildSubmissionWhere(organizationId: string, formId: string, filters: SubmissionExportFilters): Promise<Prisma.SubmissionWhereInput | null>;

/** Nº de respuestas del formulario en la organización, sin filtros (para decidir el 404). */
export function countSubmissionsOfForm(organizationId: string, formId: string): Promise<number>;

/** Mismas filas que el listado sin paginar: orderBy [{ capturedAt: "desc" }, { id: "desc" }], take = limit.
 *  Devuelve [] si buildSubmissionWhere devuelve null. */
export function listSubmissionsForExport(
  organizationId: string,
  formId: string,
  filters: SubmissionExportFilters,
  limit: number,
): Promise<Array<Pick<Submission, "formTitle" | "capturedAt" | "syncedAt" | "submittedByName" | "formVersionNumber" | "formVersionSnapshot" | "answers">>>;
```

```ts
// src/server/submissions/submission.service.ts (modificación)
/** Extraído de listSubmissions: traduce el querystring parseado a SubmissionExportFilters
 *  (fechas a inicio/fin de día, fieldId+fieldValue contra findFilterableFields; si el campo ya
 *  no existe se ignora el filtro). listSubmissions lo usa y añade `page`. */
export function toListFilters(input: Omit<SubmissionFiltersInput, "page">, filterableFields: Field[]): SubmissionExportFilters;
```

```ts
// src/server/outputs/export.service.ts
export type SubmissionExport = {
  filename: string;          // `${slug(formTitle)}-respuestas-${YYYYMMDD}.${format}`; slug: minúsculas, [a-z0-9-], "respuestas" si queda vacío
  contentType: string;       // xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; csv: "text/csv; charset=utf-8"
  body: Buffer;              // csv: Buffer.from(serializeCsv(table), "utf8")
  rowCount: number;
};

/** 1. countSubmissionsOfForm === 0 -> NotFoundError("No se ha encontrado el formulario.") (también si es de otra organización).
 *  2. filterableFields = findFilterableFields; filters = toListFilters(...).
 *  3. rows = listSubmissionsForExport(..., EXPORT_MAX_ROWS + 1); si rows.length > EXPORT_MAX_ROWS ->
 *     ValidationError("Hay demasiadas respuestas para exportar de una vez (máximo 10 000). Acota con filtros.").
 *  4. table = buildExportTable(rows, { buildFileLink: (f) => buildFileExportLink(baseUrl, f) }); serializar.
 *  El nombre del fichero usa formTitle de la primera fila (o "respuestas" si no hay filas).
 *  No registra contenido de respuestas en logs (RNF-SUB-03). Cubre: RF-OUT-05, RF-OUT-11 */
export function exportSubmissions(
  organizationId: string,
  formId: string,
  query: SubmissionExportQuery,
  baseUrl: string,
): Promise<SubmissionExport>;
```

### Ruta

| Ruta | Método | Respuesta |
| --- | --- | --- |
| `/api/forms/[id]/submissions/export?format=xlsx\|csv&dateFrom&dateTo&submittedBy&fieldId&fieldValue&q` | `GET` | 200 con el fichero, `Content-Type`, `Content-Disposition: attachment; filename="<filename>"`, `Cache-Control: no-store`. |

El handler: `requireSession({ role: "admin" })` → `submissionExportQuerySchema.safeParse` de `searchParams` (cadenas vacías = ausentes) → `exportSubmissions(user.organizationId, id, query, baseUrl)`. `export const dynamic = "force-dynamic"`.

`baseUrl` se resuelve en el handler, no en las funciones puras: `process.env.AUTH_URL` si está definida y no vacía (sin barra final); si no, `request.nextUrl.origin`. `AUTH_URL` ya está en `.env.example`. El filename del `Content-Disposition` sale de `slug(formTitle)` (solo `[a-z0-9-]`), lo que impide inyectar cabeceras.

## Errores

| Error de dominio | HTTP | Cuerpo |
| --- | --- | --- |
| `UnauthorizedError` | 401 | `{ "error": "<mensaje>" }` |
| `ForbiddenError` (rol `collector`) | 403 | `{ "error": "<mensaje>" }` |
| `NotFoundError` (formulario sin respuestas en la organización, o de otra) | 404 | `{ "error": "No se ha encontrado el formulario." }` |
| Query inválida (`format` ausente o desconocido, fecha mal formada) | 400 | `{ "error": "Parámetros no válidos." }` |
| `ValidationError` (más de 10 000 filas) | 400 | `{ "error": "<mensaje>" }` |
| Filtros válidos sin coincidencias | 200 | fichero solo con cabeceras |

## Seguridad y privacidad

- Todas las consultas llevan `organizationId`; el `organizationId` sale de la sesión, nunca de la query. El 404 es idéntico para "no existe" y "es de otra organización" (CA-OUT-06).
- La exportación contiene datos personales: no se registra su contenido en logs, solo `formId` y `rowCount`.
- Sin URLs firmadas de larga duración; los enlaces a archivos requieren sesión de la organización (RF-STO-02, RF-STO-03).
- `Cache-Control: no-store` en la descarga.

## Tests

| Criterio / Requisito | Tipo | Fichero |
| --- | --- | --- |
| RF-OUT-12, CA-OUT-05 | Vitest | `src/lib/outputs/cell-safety.test.ts` — `=1+1`, `=SUMA(A1)`, `-1+1`, `+1a`, `-x`, `@a`, `\t=1` y `\r=1` se prefijan con `'`; `-3.5`, `40.4, -3.7` y `+34600123456` quedan intactos; texto normal intacto. |
| RF-OUT-06, CA-OUT-05 | Vitest | `src/lib/outputs/format-cell.test.ts` — un caso por tipo de campo, vacío, fotos separadas por `\n`, y `=...` neutralizado. |
| RF-OUT-06 | Vitest | `src/lib/outputs/file-link.test.ts` — clave con `/` y espacios codificada; baseUrl sin barra final. |
| CA-OUT-04, CA-OUT-02 | Vitest | `src/lib/outputs/export-table.test.ts` — v1+v2: columna nueva con vacío en la fila v1; etiqueta de la más reciente; campo retirado en v2 se conserva; sin filas = solo cabeceras; snapshot inválido no rompe. |
| RNF-OUT-04 | Vitest | `src/lib/outputs/csv.test.ts` — BOM, `;`, comillas, saltos de línea. |
| CA-OUT-02, CA-OUT-05 | Vitest | `src/server/outputs/xlsx.test.ts` — cargar el buffer con exceljs: 1 fila de cabecera + 3 de datos; un `number` es numérico; una celda `=1+1` queda como `'=1+1` con `cell.type === ExcelJS.ValueType.String` (no `Formula`). |
| RF-OUT-11, CA-OUT-06 | Vitest | `src/server/outputs/export.service.test.ts` (BD real) — coincide con `listSubmissionsByForm` con los mismos filtros; org B pidiendo el formulario de A -> `NotFoundError`; más de `EXPORT_MAX_ROWS` -> `ValidationError` (con el máximo parametrizable por mock de la constante); el `baseUrl` recibido aparece en los enlaces de archivos; `filename` con título con saltos de línea, comillas y acentos (`"Parte\n\"Obra\" ñ é"`) da solo `[a-z0-9-]`. |
| RF-OUT-11, CA-OUT-06 | Vitest | `src/server/submissions/submission.repository.test.ts` — `listSubmissionsForExport` y `countSubmissionsOfForm` no devuelven datos de otra organización con el mismo `formId`. |
| RF-OUT-11 | Vitest | Test del handler (`src/app/api/forms/[id]/submissions/export/route.test.ts`) — `baseUrl` = `AUTH_URL` si está definida y, si no, `request.nextUrl.origin`. |
| CA-OUT-02, CA-OUT-04, CA-OUT-05, CA-OUT-06 | Playwright | `e2e/outputs-export.spec.ts` — descarga real de CSV y xlsx por la ruta con sesión admin; 401 sin sesión; 403 collector; 404 de otra organización y 404 de un formulario inexistente con el mismo cuerpo. |

**Regla de nombres:** el nombre de cada test (`it`/`test`, en todos los ficheros de arriba) debe contener el identificador del requisito o criterio que cubre (`CA-OUT-04`, `RF-OUT-11`...), porque el plan de pruebas filtra con `-t` y verifica que se ejecutan.

## Tareas de desarrollo

| Orden | Tarea | Depende de |
| --- | --- | --- |
| 1 | Migración `add_submission_version_number` y `createSubmissionFixture` | — |
| 2 | Instalar `exceljs` | — |
| 3 | `cell-safety`, `file-link`, `format-cell` + tests | — |
| 4 | `export-table`, `csv`, `export-query.schema`, `export-href` + tests | 3 |
| 5 | `xlsx.ts` + test | 2, 4 |
| 6 | Refactor `buildSubmissionWhere` y `toListFilters` (los tests de #7 siguen verdes) + nuevas funciones del repositorio + tests | 1 |
| 7 | `export.service.ts` + test | 4, 5, 6 |
| 8 | Route handler (con `baseUrl` = `AUTH_URL` o `origin`) y su test | 7 |
| 9 | `export-buttons.tsx` y cambio en la página del listado | 4, 8 |
| 10 | Fixture v2, helper e2e y `e2e/outputs-export.spec.ts` | 8, 9 |

## Historial de cambios

- 2026-11-26 — Diseño inicial (#28): exportación a CSV y xlsx reutilizando el filtrado del listado; unión de versiones; `Submission.formVersionNumber` nullable; enlace autenticado a fotos y firmas; neutralización de fórmulas; `exceljs` como dependencia nueva.
- 2026-11-26 — Revisión del arquitecto (#28): `baseUrl` desde `AUTH_URL` u `origin`; casos de borde de `neutralizeFormula`; xlsx siempre con texto, nunca fórmula; test de `filename`; test del handler; regla de nombres de test con el identificador; fotos separadas por `\n`; `Submission.formVersionNumber` aprobado (lo rellenará `form-publishing`).
