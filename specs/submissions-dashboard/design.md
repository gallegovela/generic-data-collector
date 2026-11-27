# Respuestas y panel — Diseño técnico

- **Requisitos:** [README.md](README.md)
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #7 (diseño), padre #1; #27 (recepción de respuestas, padre #23; ver la sección "Recepción de respuestas (#27)")

## Resumen

El issue #7 construye solo la mitad de **solo lectura** del módulo: listado paginado y filtrable de respuestas por formulario, ficha de detalle, y un panel de inicio con contadores. La recepción real desde la PWA (RF-SUB-01 a RF-SUB-04) y el disparo de salidas (RF-SUB-09) quedan fuera porque dependen de `form-publishing` (estados `draft`/`published` y `FormVersion`) y `file-storage` (fotos y firma reales), ninguno con issue propio todavía — se recomienda abrirlos como siguiente paso (ver "Riesgos y recomendaciones" más abajo).

Dos decisiones de acoplamiento, explicadas en detalle en "Modelo de datos":

1. **`Submission` no tiene clave foránea a `Form`** (de `form-editor`, #6) **ni a `FormVersion`** (de `form-publishing`, sin issue). El issue #7 depende solo de `tenancy-auth` (#4) y `form-schema` (#5), igual que indica su propia descripción; `form-editor`/`form-publishing` son módulos distintos que se fusionan de forma independiente (regla de `merge` por `module:<modulo>`), así que `submissions-dashboard` no puede exigir que su tabla exista en un orden concreto. `Submission.formId` es un identificador lógico de texto; `Submission.formTitle` guarda una copia de su nombre para no tener que unir con otra tabla. Cuando se diseñe `form-publishing`, decidirá si convierte `formId` en una clave foránea real (migración futura, fuera de este issue).
2. **Cada `Submission` guarda su propia copia inmutable del esquema** (`formVersionSnapshot`, con la forma de `FormVersion` de `form-schema`) en vez de apuntar a una fila de `FormVersion` que todavía no existe (RF-SUB-11). Esto ya es, además, el comportamiento que pedirá `CA-PUB-01` en el futuro ("las respuestas antiguas siguen mostrando las etiquetas de v1"): la ficha de detalle nunca tiene que mirar el formulario actual para saber qué etiquetas mostrar.

El resto del módulo es solo lectura: dos páginas (listado y ficha), ambas Server Components protegidos con `requireAdminPage()` de `tenancy-auth`, sin ninguna `server action` (no hay ninguna mutación en el alcance de #7) y sin ningún route handler propio. Los filtros del listado se mandan por querystring con un `<form method="get">` normal, así que no hace falta JavaScript en el cliente para aplicarlos. El mapa de la ficha de detalle es el único componente de cliente, por el límite de `react-leaflet` con `window`.

## Modelo de datos

```prisma
// prisma/schema.prisma — se añade este bloque

model Submission {
  id                  String   @id @default(cuid())
  organizationId      String
  formId              String   // identificador lógico del formulario; SIN relación de Prisma (ver Resumen, decisión 1)
  formTitle           String   // copia del nombre del formulario en el momento de la respuesta, para listar sin depender de otra tabla
  clientId            String   // UUID generado en el dispositivo; preparado para RF-SUB-02 (idempotencia), que no se implementa en #7
  formVersionSnapshot Json     // FormVersion (form-schema), copia inmutable con la que se rellenó (RF-SUB-11)
  answers             Json     // Record<string, unknown>, mismo contenido que validateSubmission(...).data de form-schema
  submittedByName     String?  // texto libre; sin relación con User de tenancy-auth (la recepción real que la rellenará es de #RF-SUB-01..04, fuera de #7)
  capturedAt          DateTime // fecha de la respuesta en el dispositivo
  syncedAt            DateTime @default(now()) // fecha en el servidor
  createdAt           DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])

  @@unique([organizationId, clientId])
  @@index([organizationId, formId, capturedAt])
  @@map("submissions")
}
```

```prisma
// prisma/schema.prisma — se modifica el modelo de tenancy-auth (#4) para añadir la relación inversa;
// si #4 ya está fusionado cuando se desarrolle #7, es la única línea que toca un modelo ajeno
// (mismo patrón que usó form-editor, #6, con Organization):
model Organization {
  // ...campos existentes de #4, sin cambios...
  submissions Submission[]
}
```

- Índice `[organizationId, formId, capturedAt]`: cubre el `where` del listado (siempre `organizationId` primero) y el `orderBy: { capturedAt: "desc" }` sin ordenación adicional (RNF-SUB-02).
- `@@unique([organizationId, clientId])`: no se usa activamente en #7 (no hay recepción), pero se define ya porque es un cambio de esquema — si se añadiera después de la implementación de RF-SUB-02 obligaría a otra migración; se deja preparado y documentado como "sin uso todavía" para que `form-publishing`/`field-collector` lo reutilicen directamente.
- `formVersionSnapshot` y `answers` son `Json` (JSONB en PostgreSQL); no se valida en el servidor en #7 (no hay entrada HTTP): los únicos escritores son el seed de pruebas y los tests, que son responsables de guardar datos coherentes con `form-schema`. La validación con `validateSubmission(...)` de `form-schema` es responsabilidad del módulo que reciba respuestas reales (`RF-SUB-03`, fuera de #7).
- Migración: `init_submissions_dashboard` (`npx prisma migrate dev --name init_submissions_dashboard`).

## Estructura de ficheros

| Capa | Ruta | Responsabilidad |
| --- | --- | --- |
| Modelo | `prisma/schema.prisma` (modificar) | `Submission`, relación inversa en `Organization`. |
| Esquema | `src/lib/submissions-dashboard/submission-filters.schema.ts` | `submissionFiltersSchema`, tipo `SubmissionFiltersInput`: parsea el `searchParams` del listado. |
| Lógica pura | `src/lib/submissions-dashboard/field-display.ts` | `buildFieldDisplayValue(field, answers)`: convierte un `Field` + las respuestas en lo que hay que pintar en la ficha. |
| Lógica pura | `src/lib/submissions-dashboard/file-placeholder.ts` | `resolvePlaceholderFileUrl(file, kind)`: URL de marcador de posición mientras no exista `file-storage`. |
| Repositorio | `src/server/submissions/submission.repository.ts` | Consultas Prisma de `Submission`, todas con `organizationId`. |
| Servicio | `src/server/submissions/submission.service.ts` | Reglas de negocio: listar con filtros, detalle, campos filtrables, estadísticas, alta de datos de prueba. |
| Interfaz | `src/app/admin/forms/[id]/submissions/page.tsx` | Listado (Server Component). `[id]` es `Submission.formId` (identificador lógico, ver Resumen). |
| Interfaz | `src/app/admin/forms/[id]/submissions/[submissionId]/page.tsx` | Ficha de detalle (Server Component). |
| Interfaz | `src/app/admin/page.tsx` (modificar) | Panel de inicio (RF-SUB-10): sustituye el placeholder de `tenancy-auth` (#4) por `<SubmissionStats />`. Ver "Preguntas para el arquitecto" en el issue: posible solape con #6. |
| Componentes | `src/components/submissions-dashboard/submissions-table.tsx` | Tabla del listado (fecha, enviado por, enlace a la ficha) y paginación (CA-SUB-04). |
| Componentes | `src/components/submissions-dashboard/submission-filters-bar.tsx` | `<form method="get">` con los filtros (fechas, usuario, campo+valor, texto libre); Server Component, sin JavaScript de cliente. |
| Componentes | `src/components/submissions-dashboard/submission-detail.tsx` | Compone la ficha: recorre `getVisibleFields(...)` y pinta cada campo con `submission-field-value.tsx`. |
| Componentes | `src/components/submissions-dashboard/submission-field-value.tsx` | Renderiza un `FieldDisplayValue` según su `kind` (texto, fotos, firma, gps, sección, vacío). |
| Componentes | `src/components/submissions-dashboard/submission-map.tsx` | `"use client"`; mapa Leaflet de un punto GPS, solo se monta tras `useEffect` (evita el acceso a `window` en el renderizado del servidor). |
| Componentes | `src/components/submissions-dashboard/submission-stats.tsx` | Tarjetas del panel de inicio (hoy, semana, por formulario). |
| Recursos | `public/placeholder-photo.svg`, `public/placeholder-signature.svg` | Imágenes de marcador de posición (ver `file-placeholder.ts`). |
| Datos de prueba | `prisma/fixtures/submissions-dashboard.fixtures.ts` | `buildDailyReportFormVersion()`, `buildSampleSubmissions(organizationId)`: un `FormVersion` mínimo propio (texto, `yes_no` "¿Hay incidencias?", `photo`, `signature`, `gps`) y varias `Submission` de ejemplo, usados por los tests de Vitest/Playwright y, opcionalmente, por `prisma/seed.ts` si ya existe cuando se desarrolle #7. No se usan los *fixtures* de `form-schema` (`dailyConstructionReportForm`, etc.): su contenido exacto todavía no está implementado (#5 sigue en diseño) y este módulo necesita un campo `yes_no` con una etiqueta concreta para CA-SUB-02. |

**Dependencia nueva de npm** (a confirmar por el arquitecto, ver preguntas en el issue): `leaflet`, `react-leaflet` (dependencies) y `@types/leaflet` (devDependency), para el mapa de la ficha de detalle (CA-SUB-03), sin clave de API (OpenStreetMap). Componentes de `shadcn/ui` a añadir si faltan: `table`, `badge`, `card`, `pagination` (o enlaces `<Link>` simples si el proyecto no tiene ese componente todavía — a decidir por el programador si `pagination` no existe en la versión instalada de `shadcn/ui`, usando enlaces `?page=N` simples).

## Contratos

### Funciones y tipos

```ts
// src/lib/submissions-dashboard/submission-filters.schema.ts
import { z } from "zod";

export const submissionFiltersSchema = z.object({
  dateFrom: z.string().date().optional(),   // capturedAt >= este día (00:00 local server)
  dateTo: z.string().date().optional(),     // capturedAt <= este día (23:59:59.999)
  submittedBy: z.string().trim().min(1).optional(), // RF-SUB-06, coincidencia parcial sin distinguir mayúsculas
  fieldId: z.string().min(1).optional(),    // id de un campo single_choice o yes_no del formVersionSnapshot
  fieldValue: z.string().min(1).optional(), // "true"/"false" para yes_no, id de opción para single_choice
  q: z.string().trim().min(1).optional(),   // RF-SUB-07, búsqueda libre
  page: z.coerce.number().int().positive().default(1),
});
export type SubmissionFiltersInput = z.infer<typeof submissionFiltersSchema>;
export const SUBMISSIONS_PAGE_SIZE = 20; // RF-SUB-05, CA-SUB-04
```

```ts
// src/lib/submissions-dashboard/field-display.ts
import type { Field, FileRef, GpsAnswer } from "@/lib/form-schema";

export type FieldDisplayValue =
  | { kind: "section"; title: string; description?: string }
  | { kind: "empty" }                                   // visible pero sin respuesta (campo opcional)
  | { kind: "text"; text: string }                       // text, number, date, datetime, time, single_choice, multiple_choice, yes_no
  | { kind: "photos"; files: FileRef[] }
  | { kind: "signature"; file: FileRef }
  | { kind: "gps"; value: GpsAnswer };

/** No tiene E/S. Traduce `field.type` + `answers[field.id]` a algo que pintar:
 *  - "section" -> { kind: "section", title: field.label, description: field.description }
 *  - sin responder (answers[field.id] es undefined/null) -> { kind: "empty" }
 *  - single_choice -> busca la label de la opción en field.config.options; si no la encuentra, usa el id crudo
 *  - multiple_choice -> las labels de las opciones seleccionadas, unidas con ", "
 *  - yes_no -> "Sí" / "No"
 *  - text/number/date/datetime/time -> String(value)
 *  - photo -> { kind: "photos", files: value as FileRef[] }
 *  - signature -> { kind: "signature", file: value as FileRef }
 *  - gps -> { kind: "gps", value: value as GpsAnswer } */
export function buildFieldDisplayValue(
  field: Field,
  answers: Record<string, unknown>,
): FieldDisplayValue;
```

```ts
// src/lib/submissions-dashboard/file-placeholder.ts
import type { FileRef } from "@/lib/form-schema";

// TODO(file-storage, RF-STO-02): sustituir por una URL firmada real cuando exista el módulo.
export function resolvePlaceholderFileUrl(file: FileRef, kind: "photo" | "signature"): string;
// Devuelve "/placeholder-photo.svg" o "/placeholder-signature.svg"; no usa `file.key` todavía
// (no hay almacenamiento real), pero mantiene la firma con `file` para no tener que cambiarla
// cuando exista `file-storage`.
```

```ts
// src/server/submissions/submission.repository.ts
import type { Submission } from "@prisma/client";
import type { FormVersion } from "@/lib/form-schema";

export type SubmissionListFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  submittedBy?: string;
  fieldFilter?: { fieldId: string; value: string | boolean };
  textQuery?: string;
  page: number;
};

export type SubmissionListItem = {
  id: string;
  capturedAt: Date;
  syncedAt: Date;
  submittedByName: string | null;
};

export type SubmissionStats = {
  today: number;
  thisWeek: number;
  byForm: Array<{ formId: string; formTitle: string; count: number }>;
};

/** `where` siempre incluye `{ organizationId, formId }`. Si `filters.textQuery` está
 *  informado, antes hace una consulta SQL cruda (ver más abajo) para resolver los `id`
 *  candidatos y añade `id: { in: candidateIds }`; si no hay ninguno, devuelve
 *  `{ items: [], total: 0 }` sin llegar a hacer la consulta principal.
 *  `orderBy: { capturedAt: "desc" }`, `skip`/`take` con SUBMISSIONS_PAGE_SIZE (CA-SUB-04). */
export function listSubmissionsByForm(
  organizationId: string,
  formId: string,
  filters: SubmissionListFilters,
): Promise<{ items: SubmissionListItem[]; total: number }>;

export function findSubmissionById(organizationId: string, id: string): Promise<Submission | null>;

/** Busca las últimas N (p. ej. 20) respuestas de ese formId y, de la más reciente,
 *  devuelve los campos `single_choice`/`yes_no` de su `formVersionSnapshot.fields`
 *  (RF-SUB-06); `[]` si no hay ninguna respuesta todavía. */
export function findFilterableFields(organizationId: string, formId: string): Promise<Field[]>;

export function getSubmissionStats(organizationId: string): Promise<SubmissionStats>;
// today: capturedAt >= inicio del día actual (hora del servidor, suficiente para el piloto)
// thisWeek: capturedAt >= lunes de esta semana
// byForm: GROUP BY formId, formTitle (groupBy de Prisma), count() por grupo, orderBy count desc

/** Única función de escritura del módulo en #7: la usan solo los tests y, si existe ya,
 *  `prisma/seed.ts`. No valida `answers` contra `formVersionSnapshot` (responsabilidad de
 *  la recepción real, fuera de alcance, RF-SUB-03). */
export function createSubmissionFixture(
  organizationId: string,
  data: {
    formId: string;
    formTitle: string;
    clientId: string;
    formVersionSnapshot: FormVersion;
    answers: Record<string, unknown>;
    submittedByName?: string;
    capturedAt: Date;
  },
): Promise<Submission>;
```

```ts
// src/server/submissions/submission.repository.ts (consulta cruda de RF-SUB-07)
import { Prisma } from "@prisma/client";

/** `answers::text ILIKE '%query%'`, siempre con organizationId y formId en el WHERE
 *  (parametrizado con Prisma.sql, nunca concatenado). Devuelve solo los `id`. */
async function findSubmissionIdsByText(
  organizationId: string,
  formId: string,
  query: string,
): Promise<string[]>;
```

```ts
// src/server/submissions/submission.service.ts
import { NotFoundError } from "@/lib/errors"; // de tenancy-auth (#4)
import type { SubmissionFiltersInput } from "@/lib/submissions-dashboard/submission-filters.schema";

export type SubmissionListResult = {
  items: SubmissionListItem[];
  total: number;
  page: number;
  pageSize: number;
  filterableFields: Field[]; // para pintar las opciones del formulario de filtros
};

/** Traduce `SubmissionFiltersInput` (querystring ya parseado) a `SubmissionListFilters`:
 *  - dateFrom/dateTo -> Date a medianoche local / fin de día.
 *  - fieldId + fieldValue -> busca el campo en `findFilterableFields`; si es "yes_no",
 *    `fieldValue === "true"`; si no existe ese campo, se ignora el filtro (sin error:
 *    pudo cambiar de formulario entre peticiones). */
export async function listSubmissions(
  organizationId: string,
  formId: string,
  input: SubmissionFiltersInput,
): Promise<SubmissionListResult>;

/** NotFoundError si `id` no existe en `organizationId` (-> notFound() en la página). */
export async function getSubmissionDetail(
  organizationId: string,
  id: string,
): Promise<Submission>;

export async function getHomeStats(organizationId: string): Promise<SubmissionStats>;
```

### Páginas

| Ruta | Tipo | Responsabilidad |
| --- | --- | --- |
| `/admin/forms/[id]/submissions` | Server Component | `requireAdminPage()`; parsea `searchParams` con `submissionFiltersSchema`; `submissionService.listSubmissions(organizationId, params.id, filters)`; `<SubmissionFiltersBar .../>` + `<SubmissionsTable .../>`. |
| `/admin/forms/[id]/submissions/[submissionId]` | Server Component | `requireAdminPage()`; `submissionService.getSubmissionDetail` o `notFound()`; `<SubmissionDetail submission={...} />`. |
| `/admin` (modificar) | Server Component | `requireAdminPage()`; `submissionService.getHomeStats(organizationId)`; `<SubmissionStats stats={...} />` (RF-SUB-10, CA-SUB-06). |

## Flujos

```mermaid
sequenceDiagram
  participant A as Administrador
  participant Page as /admin/forms/[id]/submissions
  participant Svc as submission.service.ts
  participant Repo as submission.repository.ts
  participant DB as PostgreSQL

  A->>Page: GET ?dateFrom=2026-11-01&fieldId=has_incidents&fieldValue=true
  Page->>Page: submissionFiltersSchema.safeParse(searchParams)
  Page->>Svc: listSubmissions(organizationId, formId, filters)
  Svc->>Repo: findFilterableFields(organizationId, formId)
  Repo->>DB: SELECT ... ORDER BY capturedAt DESC LIMIT 1
  Svc->>Repo: listSubmissionsByForm(organizationId, formId, { ... })
  Repo->>DB: SELECT ... WHERE organizationId = ? AND formId = ? AND ...
  Repo-->>Svc: { items, total }
  Svc-->>Page: SubmissionListResult
  Page-->>A: tabla + paginación (CA-SUB-02, CA-SUB-04, CA-SUB-08)
```

```mermaid
sequenceDiagram
  participant A as Administrador
  participant Page as /admin/forms/[id]/submissions/[submissionId]
  participant Svc as submission.service.ts
  participant FSC as form-schema
  participant Map as SubmissionMap (cliente)

  A->>Page: GET
  Page->>Svc: getSubmissionDetail(organizationId, id)
  Svc-->>Page: Submission (con formVersionSnapshot y answers)
  Page->>FSC: getVisibleFields(formVersionSnapshot, answers)
  FSC-->>Page: Field[] visibles
  loop por cada Field visible
    Page->>Page: buildFieldDisplayValue(field, answers)
  end
  Page->>Map: SubmissionMap({ lat, lng, accuracy }) si hay un campo gps respondido
  Map-->>A: mapa Leaflet/OpenStreetMap (CA-SUB-03)
  Page-->>A: ficha completa, solo lectura (CA-SUB-07, CA-SUB-09)
```

## Errores

| Error de dominio | HTTP / página | Mensaje en la interfaz |
| --- | --- | --- |
| `UnauthorizedError` (de `requireSession`) | — | Redirige a `/login` (vía `requireAdminPage`). |
| `ForbiddenError` | — | Redirige a `/collect` (rol `collector` en `/admin`). |
| `NotFoundError` (respuesta inexistente o de otra organización) | 404 / `notFound()` | "No se ha encontrado la respuesta." |
| Formulario sin respuestas todavía (`formId` sin ninguna fila) | 200 | No es un error: listado vacío, "No hay respuestas para este formulario todavía.", sin filtros de campo disponibles. |

## Seguridad y privacidad

- Todas las consultas de `submission.repository.ts` llevan `organizationId` en el `WHERE` (también la consulta cruda de texto libre, con `Prisma.sql` parametrizado, nunca concatenación de strings).
- `/admin/forms/**` y `/admin` ya están bajo el `matcher` de `middleware.ts` de `tenancy-auth`; este módulo no añade protección propia.
- `answers` y `formVersionSnapshot` contienen datos personales de la organización (nombres, fotos, firma, GPS): ningún log de este módulo imprime su contenido, solo `id`/`formId` (RNF-SUB-03, igual que `form-schema` con `FormVersion` y `form-editor` con `Form.draftSchema`).
- Las fotos y la firma se muestran con un marcador de posición fijo (`resolvePlaceholderFileUrl`), nunca con una URL real sin firmar: no hay ningún archivo real que proteger todavía en #7, pero se deja la función ya separada para que `file-storage` solo tenga que cambiar su implementación.
- El mapa usa los *tiles* públicos de OpenStreetMap (`https://{s}.tile.openstreetmap.org`) sin clave de API ni cookies de terceros.

## Tests

| Criterio / Requisito | Tipo | Fichero |
| --- | --- | --- |
| RF-SUB-11 | Vitest | `src/server/submissions/submission.repository.test.ts` — `createSubmissionFixture` guarda `formVersionSnapshot` tal cual, sin mutarlo. |
| — (filtro por organización, PP-SUB-01) | Vitest | `src/server/submissions/submission.repository.test.ts` — con el `organizationId` de la organización B pero el `id`/`formId`/texto de la organización A, `findSubmissionById`, `listSubmissionsByForm`, `findFilterableFields`, `getSubmissionStats` y la búsqueda de texto (`findSubmissionIdsByText`) no devuelven ningún dato de A. |
| CA-SUB-04 | Vitest | `src/server/submissions/submission.repository.test.ts` — con 25 respuestas creadas, la página 1 devuelve 20 y `total: 25`; la página 2 devuelve las 5 restantes. |
| CA-SUB-02 | Vitest | `src/server/submissions/submission.service.test.ts` — filtro `fieldId`/`fieldValue` sobre el campo `yes_no` "¿Hay incidencias?" de la fixture. |
| CA-SUB-08 | Vitest | `src/server/submissions/submission.service.test.ts` — filtro combinado de rango de fechas y `submittedBy`. |
| CA-SUB-05 | Vitest | `src/server/submissions/submission.repository.test.ts` — `findSubmissionIdsByText`/`listSubmissionsByForm` con `textQuery` encuentra una respuesta por una palabra de un campo de texto, sin distinguir mayúsculas. |
| CA-SUB-06 | Vitest | `src/server/submissions/submission.repository.test.ts` — `getSubmissionStats` con respuestas de hoy, de otro día de esta semana y de la semana pasada. |
| RF-SUB-06 (campos filtrables) | Vitest | `src/server/submissions/submission.repository.test.ts` — `findFilterableFields` devuelve los campos `single_choice`/`yes_no` de la respuesta más reciente; `[]` si no hay ninguna. |
| — (`buildFieldDisplayValue`) | Vitest | `src/lib/submissions-dashboard/field-display.test.ts` — un caso por cada `FieldType` de la fixture (texto, `yes_no`, `photo`, `signature`, `gps`, `section`, y un campo opcional sin responder -> `{ kind: "empty" }`). |
| CA-SUB-09 | Playwright | `e2e/submissions-dashboard-detail.spec.ts` — la ficha muestra las miniaturas de las fotos, la firma, y que al pulsar una miniatura se abre la imagen a tamaño completo. |
| CA-SUB-03 | Playwright | `e2e/submissions-dashboard-detail.spec.ts` — la ficha de una respuesta con GPS muestra el contenedor del mapa (`[data-testid="submission-map"]`) con un marcador. |
| CA-SUB-07 | Playwright | `e2e/submissions-dashboard-detail.spec.ts` — la ficha no contiene ningún campo editable ni botón de guardar/editar. |
| CA-SUB-04, CA-SUB-02 | Playwright | `e2e/submissions-dashboard-listing.spec.ts` — recorrido completo: abrir el listado, aplicar el filtro "¿Hay incidencias? = Sí", cambiar de página, abrir una respuesta desde la tabla. |
| CA-SUB-06 | Playwright | `e2e/submissions-dashboard-home.spec.ts` — `/admin` muestra los contadores con los datos de la fixture. |

### RNF-SUB-02 (rendimiento con 10 000 respuestas)

No se automatiza en #7: generar 10 000 filas realistas y medir el tiempo de carga en el runner de `testPR` es un test de carga, no un test funcional, y el runner no tiene datos de ese volumen (`demo-seed`, sin issue todavía, es quien preparará datos de la demo a mayor escala). Queda en "Comprobaciones manuales" de `test-plan.md` como riesgo anotado, no como caso automático; se recomienda un test de carga específico cuando exista `demo-seed` con datos a esa escala.

## Recepción de respuestas (#27)

Añade la escritura real. Cubre RF-SUB-01 a RF-SUB-04, RF-SUB-11 y RF-SUB-12. **No hay route handler ni server action en #27**: el servicio lo llaman la pantalla de relleno (#23), el modo sin conexión y la API, que son quienes deciden la organización y construyen el actor. Las salidas (RF-SUB-09) no se disparan aquí.

### Modelo de datos (migración `add_submission_version_and_author`)

```prisma
model Submission {
  // ...campos existentes sin cambios...
  formVersionId      String?  // id de la versión publicada (identificador lógico, SIN clave foránea, como formId)
  formVersionNumber  Int?     // número de versión (1, 2, ...) para mostrarlo y filtrar
  submittedByUserId  String?  // User.id del usuario autenticado; null si es anónimo; SIN clave foránea

  @@index([organizationId, formId, formVersionNumber])
}
```

Las tres columnas son nulables: las filas anteriores a #27 (datos de #7) quedan en `NULL` y la interfaz muestra "—". La migración es solo `ALTER TABLE ... ADD COLUMN` más `CREATE INDEX`, sin `NOT NULL` ni backfill (el snapshot no contiene el número de versión). `@@unique([organizationId, clientId])` ya existe y es la base de la idempotencia.

### Ficheros nuevos o modificados

| Capa | Ruta | Cambio |
| --- | --- | --- |
| Modelo | `prisma/schema.prisma`, `prisma/migrations/<timestamp>_add_submission_version_and_author/` | Campos e índice de arriba. |
| Errores | `src/lib/submissions-dashboard/submission-errors.ts` (nuevo) | `SubmissionValidationError`. |
| Esquema | `src/lib/submissions-dashboard/submission-filters.schema.ts` (modificar) | Añade `version`. |
| Esquema | `src/lib/submissions-dashboard/create-submission.schema.ts` (nuevo) | `createSubmissionInputSchema`, constantes de límite y validación de claves de archivo. |
| Repositorio | `src/server/submissions/submission.repository.ts` (modificar) | `findSubmissionByClientId`, `insertSubmission`, `listFormVersionNumbers`; el listado devuelve y filtra por versión. |
| Servicio | `src/server/submissions/submission.service.ts` (modificar) | `createSubmission`; `listSubmissions` devuelve `versions`. |
| Interfaz | `src/components/submissions-dashboard/submissions-table.tsx`, `submission-filters-bar.tsx` (modificar) | Columna "Versión" y selector de versión. |

### Contratos

```ts
// src/lib/submissions-dashboard/submission-errors.ts
import { ValidationError } from "@/lib/errors";
import type { FieldValidationError } from "@/lib/form-schema";

/** Errores por campo. NUNCA incluye valores de respuesta, solo fieldId y mensaje (RNF-SUB-03).
 *  fieldId === "_" para errores que no son de un campo (tamaño, fecha, esquema). */
export class SubmissionValidationError extends ValidationError {
  constructor(public readonly fieldErrors: FieldValidationError[]);
}
```

```ts
// src/lib/submissions-dashboard/create-submission.schema.ts
import { z } from "zod";
export const MAX_SUBMISSION_ANSWERS_BYTES = 256 * 1024; // JSON.stringify(answers) en UTF-8

export const createSubmissionInputSchema = z.object({
  organizationId: z.string().min(1),                 // lo decide quien llama, nunca el cuerpo de una petición
  actor: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("user"), userId: z.string().min(1), userName: z.string().min(1), userOrganizationId: z.string().min(1) }),
    z.object({ kind: z.literal("anonymous") }),
  ]),
  form: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    versionId: z.string().min(1),
    versionNumber: z.number().int().positive(),
    schema: z.unknown(),                             // se parsea con FormVersionSchema dentro del servicio
  }),
  clientId: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
  capturedAt: z.coerce.date(),
});
export type CreateSubmissionInput = z.input<typeof createSubmissionInputSchema>;

/** Una clave de archivo es válida (RF-STO-01: `org/<organizationId>/<tipo>/<uuid>.<ext>`) si:
 *  - empieza por el prefijo exacto `org/<organizationId>/` (con la barra final: `org/abc` NO valida `org/abcd/...`);
 *  - no empieza por `/`, no contiene el segmento `..` y no tiene segmentos vacíos (`//`);
 *  - tras el prefijo hay al menos un segmento más. */
export function isOwnFileKey(organizationId: string, key: string): boolean;
```

```ts
// src/server/submissions/submission.repository.ts (añadidos)
export function findSubmissionByClientId(organizationId: string, clientId: string): Promise<Submission | null>;

export function insertSubmission(
  organizationId: string,
  data: {
    formId: string; formTitle: string; clientId: string;
    formVersionId: string; formVersionNumber: number;
    formVersionSnapshot: FormVersion; answers: Record<string, unknown>;
    submittedByUserId: string | null; submittedByName: string | null;
    capturedAt: Date;
  },
): Promise<Submission>; // lanza el error de Prisma P2002 si ya existe (organizationId, clientId)

/** Números de versión distintos con respuestas de ese formId, orden ascendente; ignora los NULL. */
export function listFormVersionNumbers(organizationId: string, formId: string): Promise<number[]>;

// SubmissionListFilters gana `formVersionNumber?: number` (where.formVersionNumber).
// SubmissionListItem gana `formVersionNumber: number | null`.
```

```ts
// src/server/submissions/submission.service.ts (añadidos)
export type CreateSubmissionResult = { submission: Submission; created: boolean };

/** Orden de comprobaciones:
 *  1. createSubmissionInputSchema.parse (fallo -> SubmissionValidationError con fieldId "_").
 *  2. actor.kind === "user" && actor.userOrganizationId !== organizationId -> ForbiddenError("No puedes guardar respuestas en otra organización.").
 *  3. Tamaño de answers > MAX_SUBMISSION_ANSWERS_BYTES -> SubmissionValidationError([{ fieldId: "_", message: "La respuesta es demasiado grande." }]).
 *  4. Idempotencia: findSubmissionByClientId(organizationId, clientId). Si existe:
 *       - si existing.formId !== form.id -> ConflictError("El identificador de respuesta ya se usó en otro formulario.");
 *       - si no -> { submission: existing, created: false }. NO revalida.
 *  5. FormVersionSchema.safeParse(form.schema); si falla -> SubmissionValidationError([{ fieldId: "_", message: "El esquema del formulario no es válido." }]).
 *  6. validateSubmission(schemaParsed, answers) (de form-schema), contra ESTA versión, no la última.
 *     Si falla -> SubmissionValidationError(errors). No se guarda nada.
 *  7. Claves de archivo: se recorren los `FileRef` de la SALIDA de validateSubmission (ya sin campos ocultos por lógica condicional,
 *     que no se comprueban). Un campo `photo` es un array de FileRef (`FileRef[]`) y uno `signature` es un único FileRef (`{ key, ... }`).
 *     Cada `key` debe cumplir isOwnFileKey(organizationId, key); si alguna no -> SubmissionValidationError([{ fieldId, message: "Archivo no válido." }]).
 *  8. insertSubmission(...) con answers = data validada (la salida de validateSubmission) y formVersionSnapshot = esquema parseado.
 *     submittedByUserId/submittedByName = actor user; null si anónimo. syncedAt lo pone la base de datos (RF-SUB-04).
 *     Si lanza P2002 (carrera entre dos envíos) -> volver a findSubmissionByClientId y devolver { created: false }.
 *  Errores: ForbiddenError (403), ConflictError (409), SubmissionValidationError (422).
 *  Contrato recomendado para los consumidores: creación -> 201; repetición idempotente (created: false) -> 200. */
export async function createSubmission(input: CreateSubmissionInput): Promise<CreateSubmissionResult>;
```

`SubmissionFiltersInput` gana `version: z.coerce.number().int().positive().optional()` (querystring `?version=2`) y `listSubmissions` lo traduce a `formVersionNumber`; `SubmissionListResult` gana `versions: number[]` (de `listFormVersionNumbers`) para pintar el selector. Si `version` no existe, el listado sale vacío (no es un error).

### Seguridad y privacidad (#27)

- `organizationId` es un parámetro del servicio, nunca viene del cuerpo; el control de `userOrganizationId` evita que un usuario guarde en otra organización (CA-SUB-13).
- Ningún log imprime `answers`; los errores solo llevan `fieldId` y mensajes fijos de `form-schema` (que usan la etiqueta del campo, no su valor).
- La validación contra la versión indicada (paso 6) hace que un cambio posterior del formulario no invalide respuestas antiguas (CA-SUB-12). El servicio no consulta la base de datos de formularios: confía en `form.schema`, que construye quien llama a partir de la `FormVersion` real; esa confianza es de servidor a servidor, nunca viene del navegador.
- **Restricciones para los consumidores** (#23, modo sin conexión, API): (a) cuando exista `form-publishing`, quien llama comprueba que la versión existe y está publicada y resuelve la organización a partir del formulario; el servicio no consulta la base de datos de formularios, para seguir siendo puro y testeable; (b) quien llama limita además el tamaño del cuerpo HTTP (el límite de 256 KiB del servicio solo cuenta `answers`; fotos y firmas son claves, no bytes).

### Tests (#27)

| Criterio | Tipo | Fichero |
| --- | --- | --- |
| CA-SUB-10 | Vitest | `src/server/submissions/submission.service.test.ts` — `describe("CA-SUB-10")`: dos llamadas con el mismo `clientId` -> 1 fila, `created` true y false; mismo `clientId` con otro `form.id` -> `ConflictError`; carrera simulada con `Promise.all` -> 1 fila. |
| CA-SUB-11 | Vitest | idem — `describe("CA-SUB-11")`: campo obligatorio ausente -> `SubmissionValidationError` con `fieldId` y 0 filas; el mensaje no contiene ningún valor enviado. |
| CA-SUB-12 | Vitest | idem — `describe("CA-SUB-12")`: respuesta válida para v1 con `form.schema` v1 (la v2 añade un obligatorio) -> aceptada, `formVersionNumber` 1 y snapshot de v1. |
| CA-SUB-13 | Vitest | idem — `describe("CA-SUB-13")`: actor de la organización A, `organizationId` de B -> `ForbiddenError`, 0 filas. |
| RF-SUB-01/03 (límites y claves) | Vitest | idem — `describe("limites")`: `answers` > 256 KiB rechazado; array de `photo` con una clave ajena entre otras propias -> rechazado señalando el campo; `signature` ajena rechazada; clave con `..` rechazada; fotos y firma propias aceptadas; clave ajena en un campo oculto por lógica condicional no se comprueba (se descarta). |
| RF-SUB-01 (autor) | Vitest | idem — `describe("autor")`: actor user guarda `submittedByUserId` y `submittedByName`; anónimo guarda `null` en ambos. |
| RF-SUB-04 | Vitest | idem — `describe("fechas")`: `capturedAt` se guarda tal cual y `syncedAt` lo pone el servidor. |
| `isOwnFileKey` | Vitest | `src/lib/submissions-dashboard/create-submission.schema.test.ts` — `describe("isOwnFileKey")`: clave propia válida; prefijo parecido (`org/abc/...` con organización `abc` válido, `org/abcd/...` no); `org/abc` sin barra, `/org/abc/...`, `..` y segmentos vacíos rechazados. |
| CA-SUB-14 | Vitest | `src/server/submissions/submission.repository.test.ts` — `describe("CA-SUB-14")`: listado con `formVersionNumber` filtra; `listFormVersionNumbers` devuelve `[1, 2]` sin NULL ni de otra organización. |
| CA-SUB-14 | Playwright | `e2e/submissions-dashboard-listing.spec.ts` (ampliar) — columna "Versión" y filtro `?version=`. |

## Prueba de aceptación de términos (#38)

Cubre RF-SUB-13 y CA-SUB-15. La decisión y el recorrido completo están en [form-publishing/design.md](../form-publishing/design.md#términos-y-condiciones-en-formularios-públicos-38); aquí solo lo que cambia en este módulo.

- **Modelo:** `Submission.consent Json?` (migración `add_consent_terms`, compartida con `FormVersion.consent`). Nulo en `registered` y en respuestas anteriores.
- **Tipo guardado:**

```ts
// src/lib/submissions-dashboard/create-submission.schema.ts (modificar)
export const SubmissionConsentSchema = z.object({
  acceptedAt: z.string().datetime(), // hora del servidor al insertar
  termsUrl: z.string().url(),
  privacyUrl: z.string().url(),
  formVersionNumber: z.number().int().positive(),
});
export type SubmissionConsent = z.infer<typeof SubmissionConsentSchema>;
export function parseSubmissionConsent(raw: unknown): SubmissionConsent | null; // nunca lanza

// createSubmissionInputSchema gana (opcional; lo rellena quien llama a partir de la versión guardada en servidor):
//   consent: z.object({ termsUrl: z.string().url(), privacyUrl: z.string().url(), formVersionNumber: z.number().int().positive() }).optional()
```

- **Servicio** (`createSubmission`): en el paso 8, si `input.consent` existe, `insertSubmission` recibe `consent: { ...input.consent, acceptedAt: new Date().toISOString() }`; si no, `null`. En la rama idempotente (paso 4) no se toca: devuelve la fila existente con su `consent` original. El servicio no decide cuándo se exige la aceptación: lo hará quien llame (la pieza de relleno de `field-collector`, posterior a #33). En #38 `createSubmission` solo acepta y guarda `consent`, y se prueba sobre el servicio, sin pantalla de relleno.
- **Repositorio:** `insertSubmission` acepta `consent: SubmissionConsent | null`. `SubmissionListItem` no cambia (el listado no muestra el consentimiento).
- **Interfaz:** `src/components/submissions-dashboard/submission-consent.tsx` (nuevo): `SubmissionConsentBlock({ consent: SubmissionConsent | null })`. Con `null` no pinta nada. Si no, `data-testid="submission-consent"` con «Términos aceptados el <fecha y hora local> (versión <n> del formulario)» y enlaces `terms-link` y `privacy-link` (`target="_blank"`, `rel="noopener noreferrer"`). `submission-detail.tsx` lo monta bajo los datos de cabecera, solo lectura.
- **Tests:** `submission.service.test.ts` — `describe("CA-SUB-15")`: con `consent` en la entrada se guarda con `acceptedAt` puesto por el servidor (distinto de `capturedAt`); sin `consent` queda `null`; mismo `clientId` dos veces → `acceptedAt` idéntico (no se sobrescribe). `src/components/submissions-dashboard/submission-consent.test.tsx` (si el proyecto ya tiene tests de componentes; si no, solo Playwright) y `e2e/submissions-dashboard-detail.spec.ts` (ampliar): ficha con `consent` muestra `submission-consent` y ambos enlaces; ficha sin `consent` no. El fixture `prisma/fixtures/submissions-dashboard.fixtures.ts` gana una función para crear una respuesta con `consent`.
- **Salidas:** CSV y Excel (`outputs`) no cambian en #38 (pregunta 5 del issue). `Submission.consent` forma parte de la fila y por tanto de la exportación completa de privacy-gdpr.

## Tareas de desarrollo

| Orden | Issue | Tarea | Depende de |
| --- | --- | --- | --- |
| 1 | #7 | `prisma/schema.prisma` (`Submission`, relación en `Organization`) y migración `init_submissions_dashboard` | — |
| 2 | #7 | Añadir `leaflet`, `react-leaflet`, `@types/leaflet` | — |
| 3 | #7 | `src/lib/submissions-dashboard/submission-filters.schema.ts` + test | — |
| 4 | #7 | `src/lib/submissions-dashboard/field-display.ts` + test | — |
| 5 | #7 | `src/lib/submissions-dashboard/file-placeholder.ts`; `public/placeholder-photo.svg`, `public/placeholder-signature.svg` | — |
| 6 | #7 | `prisma/fixtures/submissions-dashboard.fixtures.ts` | 4 |
| 7 | #7 | `src/server/submissions/submission.repository.ts` + test (depende de 1, 6) | 1, 6 |
| 8 | #7 | `src/server/submissions/submission.service.ts` + test | 3, 7 |
| 9 | #7 | Componentes `shadcn/ui` que falten (`table`, `badge`, `card`) | — |
| 10 | #7 | `src/components/submissions-dashboard/submission-map.tsx` | 2 |
| 11 | #7 | `src/components/submissions-dashboard/submission-field-value.tsx`, `submission-detail.tsx` | 4, 5, 10 |
| 12 | #7 | `src/components/submissions-dashboard/submissions-table.tsx`, `submission-filters-bar.tsx` | 8, 9 |
| 13 | #7 | `src/components/submissions-dashboard/submission-stats.tsx` | 8 |
| 14 | #7 | `src/app/admin/forms/[id]/submissions/page.tsx`, `.../[submissionId]/page.tsx` | 8, 11, 12 |
| 15 | #7 | `src/app/admin/page.tsx` (modificar) | 8, 13 |
| 16 | #7 | `e2e/submissions-dashboard-listing.spec.ts`, `-detail.spec.ts`, `-home.spec.ts` | 14, 15 |
| 17 | #27 | Migración `add_submission_version_and_author` y campos en `prisma/schema.prisma` | — |
| 18 | #27 | `submission-errors.ts`, `create-submission.schema.ts` (+ test), `version` en `submission-filters.schema.ts` | — |
| 19 | #27 | Repositorio: `findSubmissionByClientId`, `insertSubmission`, `listFormVersionNumbers`, filtro/columna de versión (+ tests) | 17 |
| 20 | #27 | Servicio `createSubmission` y `versions` en `listSubmissions` (+ tests) | 18, 19 |
| 21 | #27 | Tabla y barra de filtros con versión; ampliar el e2e del listado | 20 |

## Historial de cambios

- 2026-11-27 — Issue #38: sección «Prueba de aceptación de términos» (`Submission.consent`, `SubmissionConsentSchema`, bloque en la ficha).
- 2026-11-18 — Diseño inicial (#7): `Submission` sin clave foránea a `Form`/`FormVersion` (identificador lógico `formId` + copia inmutable del esquema en `formVersionSnapshot`, RF-SUB-11); listado paginado y filtrable, ficha de detalle solo lectura y panel de inicio, todos como Server Components sin ninguna mutación; mapa con `leaflet`/`react-leaflet` (dependencia nueva, pendiente de aprobación); marcador de posición para fotos/firma mientras no exista `file-storage`; RNF-SUB-02 fuera del plan de pruebas automático (riesgo anotado).
- 2026-11-26 — Issue #28 (ver `specs/outputs/design.md`): `Submission.formVersionNumber Int?` (nullable); `listSubmissionsByForm` pasa a usar `buildSubmissionWhere` y `listSubmissions` a usar `toListFilters`, sin cambiar su comportamiento; nuevas `countSubmissionsOfForm` y `listSubmissionsForExport`; el listado muestra los enlaces de exportación.
- 2026-11-26 — Diseño de la recepción (#27): servicio `createSubmission` idempotente validado contra la versión indicada, actor `user`/`anonymous`, límite de 256 KiB y validación de claves de archivo propias, campos `formVersionId`, `formVersionNumber` y `submittedByUserId` (nulables, sin clave foránea), versión visible y filtrable en el listado. Sin route handler en #27. Las tareas 17 a 21 son de #27 (las 1 a 16 son de #7 y ya están hechas).
- 2026-11-26 — Revisión del arquitecto (#27): tabla de tareas ordenada y sin duplicados; contrato de claves de archivo (`photo` es `FileRef[]`, `signature` un `FileRef`, campos ocultos no se comprueban); `isOwnFileKey` estricto (prefijo exacto con barra, sin `..`, sin barra inicial ni segmentos vacíos); códigos HTTP recomendados (422/403/409, 201/200); restricciones para los consumidores.
- 2026-11-18 — Revisión del arquitecto (#7, cambio bloqueante): la fila de "Tests" sobre el aislamiento por organización se amplía para cubrir también `findFilterableFields`, `getSubmissionStats` y la búsqueda de texto (`findSubmissionIdsByText`), no solo `findSubmissionById`/`listSubmissionsByForm` (ver PP-SUB-01 en `test-plan.md`).
