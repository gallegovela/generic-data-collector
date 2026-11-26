# Salidas de datos — Diseño técnico

- **Requisitos:** [README.md](README.md)
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #28 (exportación a CSV y Excel), #35 (destinos: email con PDF y webhook firmado), padre #23

## Resumen

El issue #28 construye la **exportación de respuestas a `.xlsx` y CSV** de un formulario (secciones hasta «Tareas de desarrollo»). El issue #35 añade los **destinos** (email con PDF y webhook firmado), su cola de envíos y la descarga del PDF; su diseño está en la parte final, desde «Destinos y envíos (#35)».

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

## Destinos y envíos (#35)

Cubre: RF-OUT-01 a 04, 07 a 10, 13 a 18; RNF-OUT-01, 02, 05, 06; CA-OUT-01, 03, 07 a 13.

### Decisiones

1. **Disparo en `createSubmission`**, solo cuando se inserta de verdad (`created: true` por el camino del `insertSubmission`; los caminos idempotente y de carrera devuelven `created: false` y no disparan). Se llama a `scheduleDeliveries`, que **nunca lanza**: si falla, se registra un log sin contenido y la respuesta se guarda igual (RF-OUT-13). Solo se *encola* con `await` (una escritura a BD); el envío real no se espera.
2. **Cola en PostgreSQL**: `Delivery` (un envío por destino y respuesta, único por `(destinationId, submissionId)`: la garantía de RF-OUT-14 la da la BD) y `DeliveryAttempt` (un registro por intento). El envío se lanza sin esperar justo después de encolar y un **procesador periódico** (`setInterval` cada `DELIVERY_POLL_INTERVAL_SECONDS`, arrancado desde `instrumentation.ts`) retoma los pendientes y reintentos vencidos. Reanuda tras un reinicio sin cron porque todo el estado está en BD (RNF-OUT-06). Varias instancias no duplican: cada envío se «reclama» con un `updateMany` condicional.
3. **Reintentos**: 5 intentos en total; esperas tras cada fallo `[60, 300, 1800, 7200]` s. Un envío con `sending` y `updatedAt` de hace más de 5 min (proceso caído) se considera vencido y se reclama de nuevo.
4. **PDF** con `@react-pdf/renderer` (**dependencia nueva**, prevista en `CLAUDE.md` como «react-pdf o similar»; hay que añadirla a `serverExternalPackages` en `next.config.ts`). La lógica (qué se muestra) está en una función pura `buildPdfModel` testeable por valores; la capa `.tsx` solo pinta el modelo. Tema desde `formVersionSnapshot.theme` (ver README, supuestos). Imágenes leídas del almacenamiento en el servidor.
5. **Webhook**: `fetch` nativo con `redirect: "manual"`, `AbortSignal.timeout`, comprobación DNS previa contra IPs bloqueadas. Firma sobre `"<timestamp>.<cuerpo>"`.
6. **Un destino por tipo y formulario** (`@@unique([formId, kind])`): simplifica UI y garantiza «un email por respuesta». El email admite hasta 10 direcciones en un único mensaje.
7. **Cambios en otros módulos (mínimos)**: `sendEmail` acepta adjuntos y varios destinatarios; `file-storage` gana `readFileBytes` (adaptador `get`); `createSubmission` llama a `scheduleDeliveries`; la ficha y el listado de `submissions-dashboard` ganan un enlace.

### Modelo de datos

```prisma
enum DestinationKind { email webhook }
enum DeliveryStatus { pending sending sent failed }

model Destination {
  id             String          @id @default(cuid())
  organizationId String
  formId         String          // identificador lógico, sin FK (como Submission.formId)
  kind           DestinationKind
  enabled        Boolean         @default(true)
  emailTo        String[]        // kind=email: 1..10 direcciones en minúsculas, sin duplicados
  webhookUrl     String?         // kind=webhook
  webhookSecret  String?         // kind=webhook: "whsec_" + 64 hex; nunca se devuelve a la UI tras crearlo
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@unique([formId, kind])
  @@index([organizationId, formId])
  @@map("destinations")
}

model Delivery {
  id             String          @id @default(cuid())
  organizationId String
  destinationId  String
  formId         String
  submissionId   String          // identificador lógico, sin FK
  kind           DestinationKind
  status         DeliveryStatus  @default(pending)
  attempts       Int             @default(0)   // intentos de la ronda actual (se pone a 0 al reenviar a mano)
  nextAttemptAt  DateTime
  lastError      String?         // solo un código (ver "Códigos de error"), nunca texto remoto
  lastStatusCode Int?
  sentAt         DateTime?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@unique([destinationId, submissionId])
  @@index([status, nextAttemptAt])
  @@index([organizationId, formId, createdAt])
  @@map("deliveries")
}

model DeliveryAttempt {
  id             String   @id @default(cuid())
  deliveryId     String
  organizationId String
  number         Int      // secuencial por envío, no se reinicia al reenviar (count + 1)
  startedAt      DateTime
  durationMs     Int
  ok             Boolean
  statusCode     Int?
  error          String?  // código, como en Delivery.lastError

  @@index([deliveryId, number])
  @@index([organizationId])
  @@map("delivery_attempts")
}
```

Migración `add_destinations_and_deliveries`. Sin cambios en `Form` ni `Submission`. Borrar un destino borra en la misma transacción sus `Delivery` y `DeliveryAttempt`. Añadir a `Organization` las relaciones inversas **no** hace falta (ids lógicos).

Códigos de error (`DeliveryErrorCode`): `HTTP_<status>` (p. ej. `HTTP_500`), `TIMEOUT`, `NETWORK`, `BLOCKED_HOST`, `SMTP`, `PDF`, `SUBMISSION_GONE`, `DESTINATION_GONE`, `DESTINATION_DISABLED`. `SUBMISSION_GONE`, `DESTINATION_GONE` y `DESTINATION_DISABLED` pasan el envío directamente a `failed` (no tiene sentido reintentar).

### Variables de entorno nuevas (`src/lib/env.ts`, `.env.example` y `docker-compose.test.yml`)

| Variable | Defecto | Uso |
| --- | --- | --- |
| `EMAIL_MAX_ATTACHMENT_BYTES` | `10485760` | Tope del PDF adjunto (RF-OUT-17). |
| `WEBHOOK_TIMEOUT_SECONDS` | `10` | Espera máxima del POST (RF-OUT-15). |
| `DELIVERY_POLL_INTERVAL_SECONDS` | `30` | Periodo del procesador. |
| `DELIVERY_POLLER_ENABLED` | `true` | `false` desactiva el procesador. Se valida con `z.enum(["true","false"]).transform(v => v === "true")` (no `z.coerce.boolean`, que convierte `"false"` en `true`). |

En `docker-compose.test.yml` (`x-test-env`): `SMTP_HOST: mailpit` (hoy no está y el email no llegaría a Mailpit) y `DELIVERY_POLLER_ENABLED: "false"` (el procesador de `web` compartiría la BD con las pruebas de Vitest y les robaría envíos). Las pruebas llaman a `processDelivery`/`processDueDeliveries` directamente.

### Estructura de ficheros

| Capa | Ruta | Responsabilidad |
| --- | --- | --- |
| Modelo | `prisma/schema.prisma` (modificar) | `Destination`, `Delivery`, `DeliveryAttempt` y enums. |
| Validación | `src/lib/outputs/destination.schema.ts` | Esquemas Zod de entrada de destinos. |
| Lógica pura | `src/lib/outputs/webhook-url.ts` | `checkWebhookUrl`, `isBlockedIp` (SSRF). |
| Lógica pura | `src/lib/outputs/webhook-signature.ts` | `signWebhookBody`, `verifyWebhookSignature`, constantes de cabeceras. |
| Lógica pura | `src/lib/outputs/webhook-payload.ts` | `buildWebhookPayload`. |
| Lógica pura | `src/lib/outputs/delivery-policy.ts` | `MAX_DELIVERY_ATTEMPTS`, `DELIVERY_BACKOFF_SECONDS`, `nextAttemptDelaySeconds`, `STUCK_SENDING_SECONDS`. |
| Lógica pura | `src/lib/outputs/pdf-model.ts` | `buildPdfModel`, `resolvePdfTheme`. |
| Lógica pura | `src/lib/outputs/filename.ts` | `slugify` (extraída de `export.service.ts`, que pasa a importarla) y `buildPdfFilename`. |
| Integración | `src/server/integrations/email.ts` (modificar) | `sendEmail` con adjuntos y varios destinatarios. |
| Integración | `src/server/storage/storage-adapter.ts`, `s3-storage-adapter.ts`, `in-memory-storage-adapter.ts` (modificar) | Método `get(key): Promise<Uint8Array>`. |
| Servicio | `src/server/storage/storage.service.ts` (modificar) | `readFileBytes(organizationId, key)`. |
| PDF | `src/server/outputs/pdf/submission-pdf.tsx` | Render react-pdf del modelo (solo presentación). |
| Servicio | `src/server/outputs/submission-pdf.service.ts` | Carga imágenes, aplica el tope, genera el PDF. |
| Repositorio | `src/server/outputs/destination.repository.ts` | Acceso a `Destination`. |
| Servicio | `src/server/outputs/destination.service.ts` | Alta, cambio, borrado y consulta de destinos. |
| Repositorio | `src/server/outputs/delivery.repository.ts` | Acceso a `Delivery` y `DeliveryAttempt`. |
| Servicio | `src/server/outputs/webhook-sender.ts` | `postWebhook`. |
| Servicio | `src/server/outputs/email-sender.ts` | `sendSubmissionEmail`. |
| Servicio | `src/server/outputs/delivery.service.ts` | `scheduleDeliveries`, `processDelivery`, `processDueDeliveries`, `retryDelivery`, `listDeliveries`. |
| Servicio | `src/server/outputs/delivery-poller.ts` | `startDeliveryPoller`. |
| Arranque | `instrumentation.ts` (modificar) | `register` pasa a `async` y arranca el procesador en runtime `nodejs`. |
| Servicio | `src/server/submissions/submission.service.ts` (modificar) | Llama a `scheduleDeliveries` tras insertar. |
| Entrada | `src/server/outputs/destination.actions.ts` | Server actions de destinos y reenvío. |
| Entrada | `src/app/api/forms/[id]/submissions/[submissionId]/pdf/route.ts` | `GET` descarga del PDF, solo `admin`. |
| Interfaz | `src/app/admin/forms/[id]/destinations/page.tsx` | Página «Destinos» (admin). |
| Interfaz | `src/components/outputs/destinations-panel.tsx` | Formularios de email y webhook, secreto una sola vez, aviso RGPD. |
| Interfaz | `src/components/outputs/delivery-history.tsx` | Historial y botón «Reenviar». |
| Interfaz | `src/components/outputs/pdf-download-link.tsx` | Enlace «Descargar PDF». |
| Interfaz | `src/app/admin/forms/[id]/submissions/page.tsx` y `.../[submissionId]/page.tsx` (modificar) | Enlace «Destinos» y enlace «Descargar PDF». |
| Config | `next.config.ts` (modificar) | `serverExternalPackages: ["@react-pdf/renderer"]`. |
| Config | `src/lib/env.ts`, `.env.example`, `docker-compose.test.yml` (modificar) | Variables nuevas. |
| Datos de prueba | `prisma/fixtures/` (modificar) | Helpers `createDestinationFixture`, `createSubmissionWithTheme` (formVersionSnapshot con `theme.logoKey`). |
| Tests | ver «Tests (#35)» | |

**Dependencia nueva de npm** (a confirmar por el arquitecto): `@react-pdf/renderer` (`dependencies`).

### Contratos

```ts
// src/lib/outputs/destination.schema.ts
export const MAX_EMAIL_RECIPIENTS = 10;
export const saveEmailDestinationSchema = z.object({
  emails: z.array(z.string().trim().toLowerCase().email().max(254)).min(1).max(MAX_EMAIL_RECIPIENTS)
    .transform((list) => [...new Set(list)]),
  enabled: z.boolean().default(true),
});
export const saveWebhookDestinationSchema = z.object({
  url: z.string().trim().max(2048).superRefine(/* checkWebhookUrl({allowLoopback}) -> issue con el motivo en español */),
  enabled: z.boolean().default(true),
});
export type SaveEmailDestinationInput = z.infer<typeof saveEmailDestinationSchema>;
export type SaveWebhookDestinationInput = z.infer<typeof saveWebhookDestinationSchema>;
```
`allowLoopback` en el esquema sale de `process.env.NODE_ENV !== "production"` (el esquema lo usan cliente y servidor; en el cliente solo da el aviso temprano, la decisión real es la del servidor).

```ts
// src/lib/outputs/webhook-url.ts
export type WebhookUrlCheck = { ok: true; url: URL } | { ok: false; reason: "invalid" | "protocol" | "credentials" | "blocked_host" };
/** Sin E/S. Solo http/https; rechaza credenciales en la URL (user:pass@); si el host es una IP literal
 *  o "localhost"/"*.localhost"/"*.local"/"*.internal", aplica isBlockedIp. Los demás nombres pasan
 *  (se resuelven al enviar). Cubre: RF-OUT-15, CA-OUT-10 */
export function checkWebhookUrl(raw: string, opts: { allowLoopback: boolean }): WebhookUrlCheck;
/** IPv4: 0/8, 10/8, 100.64/10, 169.254/16 (incluye metadatos de nube), 172.16/12, 192.0.0/24,
 *  192.168/16, 198.18/15, 224/4 y 240/4 siempre bloqueadas; 127/8 solo si !allowLoopback.
 *  IPv6: :: , fc00::/7, fe80::/10 siempre; ::1 solo si !allowLoopback; ::ffff:a.b.c.d se evalúa como IPv4.
 *  Entrada que no es IP -> false. */
export function isBlockedIp(ip: string, opts: { allowLoopback: boolean }): boolean;
```

```ts
// src/lib/outputs/webhook-signature.ts
export const WEBHOOK_SIGNATURE_HEADER = "X-FormIA-Signature";
export const WEBHOOK_TIMESTAMP_HEADER = "X-FormIA-Timestamp";
export const WEBHOOK_EVENT_HEADER = "X-FormIA-Event";
export const WEBHOOK_DELIVERY_HEADER = "X-FormIA-Delivery";
/** "sha256=" + hex(HMAC-SHA256(secret, `${timestamp}.${body}`)). Cubre: RF-OUT-18, CA-OUT-07 */
export function signWebhookBody(secret: string, timestamp: number, body: string): string;
/** timingSafeEqual; false si el formato no es "sha256=<64 hex>" o si |now - timestamp| > toleranceSeconds (300 por defecto). */
export function verifyWebhookSignature(
  secret: string, timestamp: number, body: string, header: string,
  opts?: { toleranceSeconds?: number; now?: Date },
): boolean;
```

```ts
// src/lib/outputs/webhook-payload.ts
export type WebhookPayload = {
  event: "submission.created";
  deliveryId: string;
  submission: {
    id: string; clientId: string; formId: string; formTitle: string;
    formVersion: number | null;          // formVersionNumber
    capturedAt: string; syncedAt: string; // ISO 8601
    submittedByName: string | null;
    answers: Record<string, unknown>;    // fotos y firmas como { key } (FileRef), nunca URLs
  };
  form: unknown; // formVersionSnapshot tal cual
};
/** Sin E/S. Determinista para los mismos datos. Cubre: RF-OUT-08, RF-OUT-18 */
export function buildWebhookPayload(submission: Submission, deliveryId: string): WebhookPayload;
```

```ts
// src/lib/outputs/delivery-policy.ts
export const MAX_DELIVERY_ATTEMPTS = 5;
export const DELIVERY_BACKOFF_SECONDS = [60, 300, 1800, 7200] as const;
export const STUCK_SENDING_SECONDS = 300;
/** Espera tras el intento nº `attemptsDone` (1..), o null si ya no quedan (attemptsDone >= 5). Cubre: RF-OUT-09 */
export function nextAttemptDelaySeconds(attemptsDone: number): number | null;
```

```ts
// src/lib/outputs/pdf-model.ts
export type PdfImageRef = { key: string };
export type PdfEntry =
  | { kind: "section"; label: string }
  | { kind: "text"; label: string; value: string }                         // vacío = "—"
  | { kind: "images"; label: string; images: PdfImageRef[]; omitted: number } // fotos (máx. 12) y firma
export type PdfModel = {
  organizationName: string; formTitle: string; versionLabel: string;       // "Versión 3" o "Versión desconocida"
  capturedAt: string; syncedAt: string;                                    // "26/11/2026 10:30" en Europe/Madrid
  submittedByName: string | null;
  theme: { primaryColor: string; secondaryColor: string; logo: PdfImageRef | null }; // por defecto "#1f2937" / "#6b7280"
  entries: PdfEntry[];
  viewUrl: string;                                                         // ficha autenticada
};
/** Sin E/S. Recorre los campos del snapshot en orden; omite los que no están en answers (ocultos) y las secciones se
 *  muestran como título. Formatos: igual que formatExportCell para texto, número, fecha, selección, sí/no y GPS
 *  (reutiliza su lógica; los archivos no pasan por buildFileLink). Si el snapshot no valida con FormVersionSchema,
 *  entries lista las claves de answers como texto. Cubre: RF-OUT-03 */
export function buildPdfModel(input: { organizationName: string; submission: Submission; baseUrl: string }): PdfModel;
/** theme del snapshot -> colores válidos (#rrggbb) o por defecto; logoKey solo si pasa isOwnFileKey(organizationId, key). */
export function resolvePdfTheme(snapshot: unknown, organizationId: string): PdfModel["theme"];
```

```ts
// src/lib/outputs/filename.ts
export function slugify(text: string): string;   // minúsculas, [a-z0-9-], "respuestas" si queda vacío
/** `${slugify(formTitle)}-${YYYYMMDD(capturedAt, UTC)}-${submissionId.slice(-8).toLowerCase()}.pdf` */
export function buildPdfFilename(formTitle: string, capturedAt: Date, submissionId: string): string;
```

```ts
// src/server/integrations/email.ts (modificación compatible)
export type SendEmailInput = {
  to: string | string[];
  subject: string; html: string; text: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
};
```
`to` en array se une con `", "`. El log sigue sin destinatarios (RNF-OUT-05).

```ts
// src/server/storage/storage-adapter.ts (modificación)
interface StorageAdapter { /* ... */ get(key: string): Promise<Uint8Array>; } // lanza si no existe
// src/server/storage/storage.service.ts
/** NotFoundError si la clave no está registrada en la organización (mismo error si es de otra). No genera URL. */
export function readFileBytes(organizationId: string, key: string): Promise<{ bytes: Uint8Array; contentType: string }>;
```

```ts
// src/server/outputs/submission-pdf.service.ts
export type GeneratedPdf = { buffer: Buffer; imagesIncluded: boolean };
/** 1. organizationName (organization.repository). 2. model = buildPdfModel(...).
 *  3. Carga logo e imágenes con readFileBytes; las que fallan, no son JPG/PNG o no existen se sustituyen por el
 *     texto «[imagen no incluida: formato no admitido en PDF]» / «[imagen no disponible]» sin lanzar.
 *  4. Renderiza con imágenes; si buffer.length > maxBytes, renderiza sin imágenes y con el aviso
 *     «Este PDF no incluye las imágenes por su tamaño. Consúltalas en <viewUrl>» (imagesIncluded=false).
 *     Si aun así supera maxBytes, lanza Error("PDF_TOO_LARGE") (el envío falla con código PDF).
 *  maxBytes por defecto = getEnv().EMAIL_MAX_ATTACHMENT_BYTES. Cubre: RF-OUT-03, RF-OUT-17, CA-OUT-13 */
export function generateSubmissionPdf(
  submission: Submission, baseUrl: string, opts?: { maxBytes?: number },
): Promise<GeneratedPdf>;

/** Para la descarga (RF-OUT-04): NotFoundError si la respuesta no existe en la organización. Mismo tope: sin imágenes si supera. */
export function getSubmissionPdfForDownload(
  organizationId: string, formId: string, submissionId: string, baseUrl: string,
): Promise<{ filename: string; buffer: Buffer }>;
```
Orden de capas del render (`submission-pdf.tsx`): cabecera con logo (si hay) y franja del color principal; título del formulario y metadatos (versión, fechas, enviado por); entradas con etiqueta en color secundario; pie con «Respuesta <id> · FormIA». `renderSubmissionPdf(model, images: Map<string, {bytes, mime}>, opts: {notice?: string}): Promise<Buffer>` usa `renderToBuffer`.

```ts
// src/server/outputs/destination.repository.ts   (todas con organizationId)
export type DestinationRecord = Destination;
export function listDestinationsByForm(organizationId: string, formId: string): Promise<Destination[]>;
export function listEnabledDestinationsByForm(organizationId: string, formId: string): Promise<Destination[]>;
export function findDestination(organizationId: string, formId: string, kind: DestinationKind): Promise<Destination | null>;
export function upsertDestination(organizationId: string, formId: string, kind: DestinationKind,
  data: { enabled: boolean; emailTo?: string[]; webhookUrl?: string; webhookSecret?: string }): Promise<Destination>; // en update NO toca webhookSecret salvo que venga
export function deleteDestinationWithDeliveries(organizationId: string, formId: string, kind: DestinationKind): Promise<boolean>; // transacción
```

```ts
// src/server/outputs/destination.service.ts
export type DestinationView = {
  kind: "email" | "webhook"; enabled: boolean;
  emails: string[];            // solo email
  webhookUrl: string | null;   // solo webhook
  hasSecret: boolean;          // nunca el secreto
};
/** Todas verifican `findFormById(organizationId, formId)` (si no existe o es de otra organización o está archivado -> NotFoundError("No se ha encontrado el formulario.")). */
export function getDestinations(organizationId: string, formId: string): Promise<DestinationView[]>;
export function saveEmailDestination(organizationId: string, formId: string, input: SaveEmailDestinationInput): Promise<DestinationView>;
/** Si el destino no existía, genera el secreto (`whsec_` + randomBytes(32).hex) y lo devuelve en `secret`; si existía, `secret: null`. */
export function saveWebhookDestination(organizationId: string, formId: string, input: SaveWebhookDestinationInput): Promise<{ destination: DestinationView; secret: string | null }>;
export function regenerateWebhookSecret(organizationId: string, formId: string): Promise<{ secret: string }>; // NotFoundError si no hay webhook
export function removeDestination(organizationId: string, formId: string, kind: DestinationKind): Promise<void>; // NotFoundError si no existe
```
Cubre: RF-OUT-01, RF-OUT-07, RF-OUT-14, RF-OUT-16.

```ts
// src/server/outputs/webhook-sender.ts
export type WebhookResult = { ok: true; statusCode: number } | { ok: false; statusCode?: number; error: "TIMEOUT" | "NETWORK" | "BLOCKED_HOST" | `HTTP_${number}` };
/** 1. checkWebhookUrl(url, {allowLoopback: NODE_ENV !== "production"}) -> BLOCKED_HOST si falla.
 *  2. Si el host no es IP literal: dns.promises.lookup(host, { all: true }); cualquier dirección bloqueada -> BLOCKED_HOST;
 *     fallo de DNS -> NETWORK.
 *  3. fetch POST, Content-Type: application/json, cabeceras de firma (timestamp = Math.floor(now/1000)), redirect: "manual",
 *     signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_SECONDS*1000). 2xx -> ok; 3xx/4xx/5xx -> HTTP_<status>; abortado -> TIMEOUT; otro -> NETWORK.
 *  No lee ni guarda el cuerpo de la respuesta. Limitación conocida: la comprobación DNS y la conexión resuelven por separado (DNS rebinding). Cubre: RF-OUT-08, RF-OUT-15 */
export function postWebhook(input: { url: string; secret: string; body: string; deliveryId: string; now?: Date; fetchImpl?: typeof fetch }): Promise<WebhookResult>;
```

```ts
// src/server/outputs/email-sender.ts
/** Un mensaje a todos los destinatarios. Asunto `Nueva respuesta: ${formTitle}` (sin saltos de línea, máx. 150 car.).
 *  Cuerpo (text y html): organización, formulario, versión, fecha de captura y enlace a la ficha; SIN respuestas ni datos
 *  personales. PDF adjunto con buildPdfFilename. Errores de SMTP -> { ok:false, error:"SMTP" }; de PDF -> "PDF".
 *  Cubre: RF-OUT-02, RNF-OUT-02 */
export function sendSubmissionEmail(destination: Destination, submission: Submission, baseUrl: string): Promise<{ ok: true } | { ok: false; error: "SMTP" | "PDF" }>;
```

```ts
// src/server/outputs/delivery.service.ts
export type DeliveryAttemptView = { number: number; startedAt: Date; durationMs: number; ok: boolean; statusCode: number | null; error: string | null };
export type DeliveryView = {
  id: string; kind: "email" | "webhook"; submissionId: string; status: "pending" | "sending" | "sent" | "failed";
  attempts: number; nextAttemptAt: Date | null; lastError: string | null; lastStatusCode: number | null;
  sentAt: Date | null; createdAt: Date; attemptLog: DeliveryAttemptView[];
};

/** NUNCA lanza. Para cada destino habilitado del formulario crea un Delivery (createMany skipDuplicates; nextAttemptAt = ahora)
 *  y lanza `void processDelivery(id).catch(logSafe)` sin esperar. Sin destinos, no hace nada. Cubre: RF-OUT-13, RF-OUT-14, RNF-OUT-01 */
export function scheduleDeliveries(organizationId: string, submission: Submission): Promise<void>;

export type ProcessOutcome = "sent" | "retry" | "failed" | "skipped"; // skipped = no vencido o ya reclamado por otro
/** 1. claimDelivery (updateMany condicional; count 0 -> "skipped").
 *  2. Carga Destination (no existe -> failed DESTINATION_GONE; !enabled -> failed DESTINATION_DISABLED) y la Submission
 *     por organizationId (no existe -> failed SUBMISSION_GONE).
 *  3. email -> sendSubmissionEmail; webhook -> body = JSON.stringify(buildWebhookPayload(...)); postWebhook.
 *  4. Siempre inserta un DeliveryAttempt. ok -> status sent, sentAt, attempts+1. Fallo -> attempts+1; delay = nextAttemptDelaySeconds(attempts);
 *     null -> failed; si no, pending con nextAttemptAt = now + delay.
 *  Excepciones inesperadas se capturan: cuentan como fallo con código NETWORK/SMTP/PDF según el tipo. Cubre: RF-OUT-09, CA-OUT-03 */
export function processDelivery(deliveryId: string, now?: Date): Promise<ProcessOutcome>;

/** Procesador del sistema: único punto sin filtro de organización (cada envío se procesa con SU organizationId). Busca hasta `limit`
 *  (20) envíos con status pending y nextAttemptAt <= now, o sending con updatedAt < now - STUCK_SENDING_SECONDS, y llama a processDelivery
 *  (en serie). Devuelve cuántos se procesaron (no "skipped"). Cubre: RNF-OUT-06 */
export function processDueDeliveries(now?: Date, limit?: number): Promise<number>;

/** NotFoundError si el envío no existe en la organización; ConflictError("Solo se pueden reenviar los envíos fallidos.") si status != failed.
 *  Pone status pending, attempts 0, nextAttemptAt ahora, lastError null y lanza processDelivery sin esperar. Cubre: RF-OUT-10, CA-OUT-11 */
export function retryDelivery(organizationId: string, formId: string, deliveryId: string): Promise<void>;

/** Los 50 últimos del formulario (createdAt desc) con sus intentos (últimos 10 por envío). NotFoundError si el formulario no es de la organización. */
export function listDeliveries(organizationId: string, formId: string): Promise<DeliveryView[]>;
```

```ts
// src/server/outputs/delivery-poller.ts
/** Idempotente (bandera global). Si DELIVERY_POLLER_ENABLED=false no hace nada. Ejecuta processDueDeliveries ya y cada
 *  DELIVERY_POLL_INTERVAL_SECONDS; setInterval().unref(); un ciclo en curso no se solapa con el siguiente; los errores se
 *  capturan y se registran sin contenido. Cubre: RNF-OUT-06 */
export function startDeliveryPoller(): void;
```

```ts
// instrumentation.ts
export async function register(): Promise<void> {
  getEnv();
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDeliveryPoller } = await import("@/server/outputs/delivery-poller");
    startDeliveryPoller();
  }
}
```

```ts
// src/server/outputs/destination.actions.ts ("use server"; todas con requireSession({ role: "admin" }) y organizationId de la sesión)
export type DestinationActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; issues?: { path: string; message: string }[] };
export function saveEmailDestinationAction(formId: string, input: SaveEmailDestinationInput): Promise<DestinationActionResult<{ destination: DestinationView }>>;
export function saveWebhookDestinationAction(formId: string, input: SaveWebhookDestinationInput): Promise<DestinationActionResult<{ destination: DestinationView; secret: string | null }>>;
export function regenerateWebhookSecretAction(formId: string): Promise<DestinationActionResult<{ secret: string }>>;
export function removeDestinationAction(formId: string, kind: DestinationKind): Promise<DestinationActionResult>;
export function retryDeliveryAction(formId: string, deliveryId: string): Promise<DestinationActionResult>;
```
Entrada inválida -> `{ ok:false, error:"Datos inválidos.", issues }`; `NotFoundError` -> `{ ok:false, error:"No se ha encontrado el formulario." }`; `ConflictError` -> su mensaje. Cada acción hace `revalidatePath(\`/admin/forms/${formId}/destinations\`)`.

### Rutas

| Ruta | Método | Respuesta |
| --- | --- | --- |
| `/api/forms/[id]/submissions/[submissionId]/pdf` | `GET` | 200 `application/pdf`, `Content-Disposition: attachment; filename="<buildPdfFilename>"`, `Cache-Control: no-store`. |
| `/admin/forms/[id]/destinations` | página | Panel de destinos (admin). Otra organización o formulario inexistente -> `notFound()` (404). |

El handler del PDF: `requireSession({ role: "admin" })` → `baseUrl` (misma regla que la exportación: `AUTH_URL` o `origin`; reutilizar la función, extrayéndola a `src/lib/outputs/base-url.ts` como `resolveBaseUrl(request)` si hoy está en el handler de exportación) → `getSubmissionPdfForDownload`. `export const runtime = "nodejs"` y `dynamic = "force-dynamic"`.

### Errores

| Situación | Resultado |
| --- | --- |
| Sin sesión / rol `collector` | 401 / 403 en la ruta del PDF; las acciones y la página usan el comportamiento de `requireSession`/`requireAdminPage`. |
| Formulario o respuesta inexistente o de otra organización | 404 (ruta, página) / `{ ok:false, error:"No se ha encontrado el formulario." }` (acciones), mismo mensaje en ambos casos. |
| URL de webhook inválida o con host bloqueado | Acción: `{ ok:false, error:"Datos inválidos.", issues:[{ path:"url", message }] }`. Mensajes: «La URL no es válida.», «Solo se admiten URLs http o https.», «La URL no puede llevar usuario ni contraseña.», «La URL apunta a una dirección privada o no permitida.» |
| Reenviar un envío que no está `failed` | `{ ok:false, error:"Solo se pueden reenviar los envíos fallidos." }` |
| Fallo del envío (SMTP, webhook, PDF) | Nunca afecta a la respuesta del trabajador; queda en `Delivery`/`DeliveryAttempt` con su código. |

### Seguridad y privacidad

- Toda consulta de destinos y envíos lleva `organizationId` de la sesión; el 404 es idéntico para «no existe» y «es de otra organización». La única excepción es `processDueDeliveries`, un proceso del sistema que no devuelve datos a ningún usuario.
- El secreto se muestra una vez (en la respuesta de la acción que lo crea o regenera) y no se incluye en `DestinationView`, ni en logs, ni en `lastError`. Regenerarlo invalida el anterior.
- Logs solo con `deliveryId`, `kind`, `status`, `statusCode` y código de error. Nunca destinatarios, URL, secreto, respuestas ni el cuerpo de la respuesta remota (RNF-OUT-05).
- El email no lleva respuestas en el cuerpo, solo en el PDF adjunto; las imágenes del PDF se leen en el servidor y no se generan URLs firmadas.
- La pantalla de destinos muestra el aviso: «Las respuestas pueden contener datos personales. Eres responsable de elegir destinatarios autorizados.»
- Limitación del piloto: sin proceso vivo no hay reintentos; hay que documentarlo en la pantalla («Si la aplicación se reinicia, los envíos pendientes se reanudan al arrancar»).

### Tests (#35)

Regla de nombres: igual que en #28 (cada `it` contiene el identificador que cubre).

| Criterio / Requisito | Tipo | Fichero |
| --- | --- | --- |
| CA-OUT-10, RF-OUT-15 | Vitest | `src/lib/outputs/webhook-url.test.ts` — `http://10.0.0.5/hook`, `http://169.254.169.254/`, `http://192.168.1.1`, `http://[fd00::1]/`, `http://[::ffff:10.0.0.1]/`, `ftp://x`, `http://user:pass@example.com`, `not a url` rechazadas; `https://example.com/hook` y `http://203.0.113.5/x` aceptadas; `http://127.0.0.1/` y `http://localhost/` aceptadas con `allowLoopback: true` y rechazadas con `false`. |
| CA-OUT-10 | Vitest | `src/lib/outputs/destination.schema.test.ts` — el esquema devuelve el mensaje en español; emails normalizados, sin duplicados, máximo 10, mínimo 1. |
| CA-OUT-10, RF-OUT-15 | Vitest | `src/server/outputs/webhook-sender.test.ts` — host que resuelve a IP privada (mock de `dns`) -> `BLOCKED_HOST` sin llamar a fetch; 302 -> `HTTP_302` sin seguir; timeout -> `TIMEOUT`; no se lee el cuerpo de la respuesta. |
| CA-OUT-07, RF-OUT-18 | Vitest | `src/lib/outputs/webhook-signature.test.ts` — vector conocido de HMAC; `verify` acepta la firma correcta y rechaza cuerpo alterado, secreto distinto, formato erróneo y marca de tiempo fuera de tolerancia. |
| CA-OUT-07, CA-OUT-03, CA-OUT-08, CA-OUT-11, RF-OUT-13, RNF-OUT-05, RNF-OUT-06, CA-OUT-01, CA-OUT-09 | Vitest (BD real, SMTP real a Mailpit, servidor HTTP local) | `src/server/outputs/delivery.integration.test.ts` (ver abajo). |
| RF-OUT-09, CA-OUT-03 | Vitest | `src/lib/outputs/delivery-policy.test.ts` — esperas 60/300/1800/7200 y `null` al 5.º intento. |
| CA-OUT-08 | Vitest | `src/server/outputs/delivery.repository.test.ts` — insertar dos veces `(destinationId, submissionId)` con `skipDuplicates` deja una fila; el claim es atómico (dos `claimDelivery` simultáneos: uno gana). |
| RNF-OUT-06 | Vitest | `src/server/outputs/delivery-poller.test.ts` — `startDeliveryPoller` es idempotente (dos llamadas, un solo intervalo), no arranca con `DELIVERY_POLLER_ENABLED=false` y ejecuta un ciclo al arrancar (con `processDueDeliveries` mockeado y temporizadores falsos). |
| RF-OUT-13 | Vitest | `src/server/submissions/submission.service.test.ts` (modificar) — `created:false` (idempotente) no llama a `scheduleDeliveries`; `created:true` sí; si `scheduleDeliveries` rechaza, `createSubmission` devuelve igualmente `{ created: true }`. |
| CA-OUT-09, RF-OUT-16 | Vitest | `src/server/outputs/destination.service.test.ts` (BD real) — org B sobre formulario de A: `getDestinations`, `saveEmailDestination`, `saveWebhookDestination`, `regenerateWebhookSecret` y `removeDestination` lanzan `NotFoundError` y no crean filas; el secreto solo se devuelve al crear (`secret` nulo al actualizar) y `DestinationView` no lo contiene; `removeDestination` borra también sus envíos. |
| RF-OUT-03, RF-OUT-17, CA-OUT-12, CA-OUT-13 | Vitest | `src/lib/outputs/pdf-model.test.ts` — orden de campos, ocultos omitidos, secciones, GPS, sí/no, tema por defecto, logo ajeno descartado, snapshot inválido. |
| CA-OUT-12, CA-OUT-13, CA-OUT-09 | Vitest (BD + MinIO o adaptador en memoria) | `src/server/outputs/submission-pdf.service.test.ts` — el buffer empieza por `%PDF-`; con logo PNG y firma el nº de `/Subtype /Image` es 2; imagen WEBP sustituida sin lanzar; con `maxBytes` pequeño se regenera sin imágenes (`imagesIncluded: false`, 0 imágenes); `getSubmissionPdfForDownload` con org B -> `NotFoundError`. |
| CA-OUT-12, CA-OUT-09 | Vitest | `src/app/api/forms/[id]/submissions/[submissionId]/pdf/route.test.ts` — 200 con cabeceras; 401; 403 collector; 404 otra organización. |
| CA-OUT-09, CA-OUT-10, CA-OUT-12 | Playwright | `e2e/outputs-destinations.spec.ts` — ver abajo. |

**`delivery.integration.test.ts`** (cada test crea sus propias organización, formulario, destino y destinatario único `dest-<uuid>@example.test`; consulta Mailpit en `process.env.MAILPIT_API_URL ?? "http://mailpit:8025"` con `GET /api/v1/search?query=to:<dirección>`, `GET /api/v1/message/<ID>` y `GET /api/v1/message/<ID>/part/<PartID>`; levanta un servidor `node:http` en `127.0.0.1` con puerto libre que registra peticiones y responde con el código que cada test decida; llama a `processDelivery`/`processDueDeliveries` con un `now` controlado en vez de esperar):

- `CA-OUT-01`: respuesta con `formVersionSnapshot.theme.logoKey` apuntando a un PNG subido con `uploadFile`; `createSubmission` + `processDueDeliveries`; en Mailpit hay 1 mensaje a ese destinatario con un adjunto `application/pdf`, nombre `*.pdf`, tamaño > 0, empieza por `%PDF-` y contiene al menos un `/Subtype /Image` (el logo).
- `CA-OUT-03`: servidor que responde 500; tras `createSubmission` y 5 rondas de `processDueDeliveries` con `now` avanzando según el backoff: `Delivery.status = failed`, `attempts = 5`, 5 filas `DeliveryAttempt` con `ok=false` y `statusCode=500`, `lastError = "HTTP_500"`, y la `Submission` existe.
- `CA-OUT-07`: servidor que responde 200; la petición recibida tiene `X-FormIA-Signature`, `X-FormIA-Timestamp` y `X-FormIA-Event`; `verifyWebhookSignature(secretDelDestino, timestamp, cuerpoCrudo, cabecera)` es `true`; con otro secreto, `false`; el JSON tiene `answers` con claves `{ key }` (sin `http`) y `form` con el snapshot.
- `CA-OUT-08`: `createSubmission` dos veces con el mismo `clientId` y `processDueDeliveries` entre medias y al final: 1 sola fila `Delivery` por destino, exactamente 1 mensaje en Mailpit y 1 POST recibido.
- `CA-OUT-11`: webhook que primero responde 500 hasta `failed`; el servidor pasa a 200; `retryDelivery` (org correcta) → `processDueDeliveries`: `status = sent`, `attempts = 1`, 6 `DeliveryAttempt` (numerados 1..6); `retryDelivery` sobre un envío `sent` -> `ConflictError`; `retryDelivery` con la organización B -> `NotFoundError`.
- `CA-OUT-09`: `listDeliveries` y `retryDelivery` con la organización B sobre datos de A lanzan `NotFoundError`.
- `RF-OUT-13`: destino de webhook a un puerto cerrado: `createSubmission` termina con `created: true` y la respuesta existe aunque el envío falle.
- `RNF-OUT-05`: con espías en `console.log/error/warn` durante un ciclo completo (email y webhook), ninguna línea contiene el destinatario, la URL, el secreto ni un valor de `answers`.
- `RNF-OUT-06`: un `Delivery` en `sending` con `updatedAt` de hace 10 min lo recoge `processDueDeliveries`; uno `pending` con `nextAttemptAt` futuro no; uno `sent` o `failed` tampoco.

**`e2e/outputs-destinations.spec.ts`** (admin demo; una segunda organización creada por el propio spec):
- CA-OUT-10: en `/admin/forms/<id>/destinations`, guardar webhook `http://10.0.0.5/hook` muestra «La URL apunta a una dirección privada o no permitida.» y no se crea el destino; `https://example.com/hook` lo guarda y muestra el secreto (`whsec_…`) una vez; tras recargar no aparece.
- RF-OUT-01: guardar email con dos direcciones; tras recargar siguen ahí.
- CA-OUT-09: administrador de la organización B abre `/admin/forms/<idDeA>/destinations` -> 404.
- CA-OUT-12: en la ficha de una respuesta, «Descargar PDF» devuelve 200 `application/pdf`; con la sesión de B, 404.

### Tareas de desarrollo (#35)

| Orden | Tarea | Depende de |
| --- | --- | --- |
| 1 | Instalar `@react-pdf/renderer`; `serverExternalPackages`; variables de entorno nuevas (`env.ts`, `.env.example`, `docker-compose.test.yml`) | — |
| 2 | Migración `add_destinations_and_deliveries` y fixtures | — |
| 3 | `webhook-url`, `webhook-signature`, `webhook-payload`, `delivery-policy`, `destination.schema`, `filename` (con la extracción de `slugify`) + tests | — |
| 4 | `sendEmail` con adjuntos; `StorageAdapter.get` + `readFileBytes` + tests | — |
| 5 | `pdf-model` + `submission-pdf.tsx` + `submission-pdf.service` + tests | 1, 3, 4 |
| 6 | Repositorios y `destination.service` + tests | 2, 3 |
| 7 | `webhook-sender`, `email-sender`, `delivery.service`, `delivery-poller`, `instrumentation.ts` + tests | 4, 5, 6 |
| 8 | Hook en `createSubmission` + tests | 7 |
| 9 | `delivery.integration.test.ts` | 7, 8 |
| 10 | Server actions, página «Destinos», componentes, ruta del PDF, enlaces en la ficha y el listado | 5, 7 |
| 11 | `e2e/outputs-destinations.spec.ts` | 10 |

## Historial de cambios

- 2026-11-26 — Diseño de destinos y envíos (#35): modelos `Destination`, `Delivery` y `DeliveryAttempt`; cola en PostgreSQL con procesador periódico en `instrumentation.ts`; PDF con `@react-pdf/renderer` desde `buildPdfModel`; webhook firmado con protección SSRF; acciones, ruta del PDF y pantalla de destinos; variables de entorno nuevas; tareas y tests.
- 2026-11-26 — Diseño inicial (#28): exportación a CSV y xlsx reutilizando el filtrado del listado; unión de versiones; `Submission.formVersionNumber` nullable; enlace autenticado a fotos y firmas; neutralización de fórmulas; `exceljs` como dependencia nueva.
- 2026-11-26 — Revisión del arquitecto (#28): `baseUrl` desde `AUTH_URL` u `origin`; casos de borde de `neutralizeFormula`; xlsx siempre con texto, nunca fórmula; test de `filename`; test del handler; regla de nombres de test con el identificador; fotos separadas por `\n`; `Submission.formVersionNumber` aprobado (lo rellenará `form-publishing`).
