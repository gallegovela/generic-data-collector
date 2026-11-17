# Editor visual de formularios — Diseño técnico

- **Requisitos:** [README.md](README.md)
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #6

## Resumen

Dos piezas de interfaz sobre un único modelo nuevo, `Form` (borrador JSON + metadatos), protegidas por el rol `admin` de `tenancy-auth`:

- **Listado** (`/admin/forms`): tabla de los formularios de la organización (nombre, estado, "versión publicada", "nº de respuestas" y fecha de modificación), con crear, duplicar y archivar.
- **Editor** (`/admin/forms/[id]`): lienzo con arrastrar y soltar (`@dnd-kit/core` + `@dnd-kit/sortable`), paleta de los 12 tipos de campo de `form-schema`, panel de propiedades (incluida la condición de visibilidad) y vista previa móvil con un tema por defecto fijo. El borrador se autoguarda 2 s después del último cambio si es válido; si no, se señala el campo con el problema y no se guarda (RF-EDT-10).

El borrador (`Form.draftSchema`) no es un `FormVersion` de `form-schema`: es un `DraftFormSchema` propio (título, descripción, `fields: Field[]`, sin el mínimo de 1 campo que exige `FormVersionSchema`), porque un formulario recién creado puede no tener campos todavía (RF-EDT-02). Reutiliza `FieldSchema` de `form-schema` para cada campo individual. `form-publishing`, cuando se diseñe, decidirá cómo convertir un borrador válido en la primera `FormVersion` inmutable.

Este módulo **no** crea `FormVersion` ni `Submission` (pertenecen a `form-publishing` y `submissions-dashboard` según sus propios README, ninguno con issue todavía): la columna "versión publicada" del listado muestra siempre "Sin publicar" y la de "nº de respuestas" siempre 0, cada una con un comentario que referencia el RF que la sustituirá. Es la pregunta 1 del borrador del analista; aquí se documenta la opción elegida por defecto.

## Modelo de datos

```prisma
// prisma/schema.prisma — se añaden estos bloques

enum FormStatus {
  draft
  published
}

model Form {
  id             String     @id @default(cuid())
  organizationId String
  name           String
  status         FormStatus @default(draft)
  draftSchema    Json
  archivedAt     DateTime?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@map("forms")
}
```

```prisma
// prisma/schema.prisma — se modifica el modelo de tenancy-auth (#4) para añadir
// la relación inversa; si #4 ya está fusionado cuando se desarrolle #6, es la
// única línea que toca un modelo ajeno:
model Organization {
  // ...campos existentes de #4, sin cambios...
  forms Form[]
}
```

- `status` nunca llega a `published` en este módulo (no hay acción de publicar en el alcance de #6); queda definido ahora para que `form-publishing` solo tenga que escribirlo, no añadir la columna.
- `draftSchema` guarda un `DraftForm` (ver [Contratos](#contratos)) serializado, **no** un `FormVersion` de `form-schema`.
- `archivedAt` no nulo excluye el formulario del listado por defecto (CA-EDT-06); no se borra ninguna fila (alineado con RGPD/`CLAUDE.md`: nada se borra sin un motivo explícito, esto es ocultar, no borrar).
- Índice: `organizationId` (siempre primero en los `where` del repositorio, como en `tenancy-auth`).
- Migración: `init_form_editor` (`npx prisma migrate dev --name init_form_editor`).

## Estructura de ficheros

| Capa | Ruta | Responsabilidad |
| --- | --- | --- |
| Modelo | `prisma/schema.prisma` (modificar) | `Form`, enum `FormStatus`, relación inversa en `Organization`. |
| Lógica pura | `src/lib/form-editor/draft-integrity.ts` | `checkDraftIntegrity`: ids duplicados y referencias `visibleIf` inválidas dentro de un borrador (sin mínimo de campos). |
| Esquema | `src/lib/form-editor/form-editor.schema.ts` | `createFormSchema`, `duplicateFormSchema`, `renameFormSchema`, `DraftFormSchema`, `saveDraftSchema` y sus tipos. |
| Lógica pura | `src/lib/form-editor/default-theme.ts` | `DEFAULT_THEME: ThemeSnapshot` (placeholder mientras no exista `theming`). |
| Lógica pura | `src/lib/form-editor/field-palette.ts` | `FIELD_PALETTE`: metadatos de interfaz (icono, etiqueta en español, campo por defecto) de cada `FieldType` de `form-schema`. |
| Repositorio | `src/server/forms/form.repository.ts` | Consultas Prisma de `Form`, todas con `organizationId`. |
| Servicio | `src/server/forms/form.service.ts` | Reglas de negocio: crear, duplicar, renombrar, guardar borrador, archivar. |
| Entrada | `src/server/forms/form.actions.ts` | Server actions que usa la interfaz. |
| Interfaz | `src/app/admin/forms/page.tsx` | Listado (Server Component). |
| Interfaz | `src/app/admin/forms/[id]/page.tsx` | Editor (Server Component, carga el `Form` y delega en `FormEditor`). |
| Componentes | `src/components/form-editor/forms-table.tsx` | Tabla del listado con menú de acciones por fila (abrir, duplicar, archivar) y los diálogos de crear/duplicar/confirmar archivado. |
| Componentes | `src/components/form-editor/form-editor.tsx` | Orquesta el editor: barra superior (nombre, indicador de guardado, botón IA deshabilitado, alternar vista previa), paleta, lienzo y panel de propiedades. |
| Componentes | `src/components/form-editor/field-palette.tsx` | Paleta de tipos de campo, arrastrable y pulsable. |
| Componentes | `src/components/form-editor/form-canvas.tsx` | Lista ordenable de campos (`@dnd-kit/sortable`), arrastrar y teclado. |
| Componentes | `src/components/form-editor/field-properties-panel.tsx` | Edita el campo seleccionado: comunes, `config` según `type`, y la condición de visibilidad. |
| Componentes | `src/components/form-editor/mobile-preview.tsx` | Vista previa simplificada (no interactiva) de los campos visibles, con `DEFAULT_THEME`. |
| Componentes | `src/components/form-editor/autosave-indicator.tsx` | "Guardando…" / "Guardado" / error con el campo señalado. |
| Hooks | `src/hooks/use-form-editor-state.ts` | Estado del borrador en el cliente: campos, selección, mover/añadir/eliminar/duplicar campo. |
| Hooks | `src/hooks/use-autosave-draft.ts` | Debounce de 2000 ms, valida con `DraftFormSchema`, llama a `saveDraftAction`, expone el estado del indicador. |

**Dependencia de interfaz nueva:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (ya fijado como stack del editor en `CLAUDE.md`, no es una dependencia nueva que decidir: solo falta instalarla). Componentes de `shadcn/ui` a añadir con `npx shadcn add <componente>`: `dialog`, `alert-dialog`, `dropdown-menu`, `input`, `textarea`, `select`, `switch`, `label`, `badge`, `table`, `tooltip`, `separator` (los que no existan ya).

## Contratos

### Funciones y tipos

```ts
// src/lib/form-editor/draft-integrity.ts
import type { RefinementCtx } from "zod";
import type { Field } from "@/lib/form-schema";

/** Mismo criterio que el refinamiento interno (no exportado) de
 *  `form-version.schema.ts` en form-schema, pero sin exigir al menos
 *  1 campo: un borrador puede estar vacío.
 *  1) id de campo duplicado -> issue en ["fields", index, "id"],
 *     `Id de campo duplicado: "<id>".`
 *  2) visibleIf.fieldId no existe entre los ids anteriores, o su
 *     índice >= índice del campo actual (posterior, el propio campo o
 *     referencia circular) -> issue en ["fields", index, "visibleIf", "fieldId"],
 *     `"<fieldId>" no existe.` / `"<fieldId>" es posterior o es el propio
 *     campo (referencia circular no permitida).` */
export function checkDraftIntegrity(
  draft: { fields: Field[] },
  ctx: RefinementCtx,
): void;
```

```ts
// src/lib/form-editor/form-editor.schema.ts
import { z } from "zod";
import { FieldSchema } from "@/lib/form-schema";
import { checkDraftIntegrity } from "./draft-integrity";

export const createFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
});
export type CreateFormInput = z.infer<typeof createFormSchema>;

export const renameFormSchema = createFormSchema;
export type RenameFormInput = z.infer<typeof renameFormSchema>;

export const duplicateFormSchema = z.object({
  sourceFormId: z.string().min(1),
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
});
export type DuplicateFormInput = z.infer<typeof duplicateFormSchema>;

export const DraftFormSchema = z
  .object({
    title: z.string().trim().min(1, "El título es obligatorio.").max(200),
    description: z.string().max(2000).optional(),
    fields: z.array(FieldSchema), // sin .min(1): un borrador puede no tener campos
  })
  .superRefine(checkDraftIntegrity);
export type DraftForm = z.infer<typeof DraftFormSchema>;

export const saveDraftSchema = z.object({ draft: DraftFormSchema });
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export type DraftFieldIssue = { fieldId: string; message: string };
/** Convierte los `issues` de un `DraftFormSchema.safeParse` fallido en
 *  una lista `{ fieldId, message }` usando el índice del `path` para
 *  resolver `fieldId = draft.fields[index].id`; útil para que la
 *  interfaz resalte el campo exacto (RF-EDT-10). */
export function mapDraftIssuesToFields(
  draft: { fields: Field[] },
  issues: z.core.$ZodIssue[],
): DraftFieldIssue[];
```

```ts
// src/lib/form-editor/default-theme.ts
import type { ThemeSnapshot } from "@/lib/form-schema";

/** Placeholder mientras `theming` no exista (ver README > Supuestos).
 *  Colores de marca de FormIA para que la vista previa no se vea gris. */
export const DEFAULT_THEME: ThemeSnapshot = {
  primaryColor: "#2563eb",
  secondaryColor: "#1e293b",
  fontFamily: "Inter",
};
```

```ts
// src/lib/form-editor/field-palette.ts
import type { FieldType } from "@/lib/form-schema";

export type FieldPaletteEntry = {
  type: FieldType;
  label: string;        // etiqueta en español para la paleta ("Texto", "Número"...)
  icon: string;          // nombre del icono de lucide-react
  buildDefaultField: (id: string) => Field; // campo por defecto al añadirlo (label genérica, config mínima)
};

export const FIELD_PALETTE: readonly FieldPaletteEntry[]; // una entrada por cada FIELD_TYPES de form-schema
```

```ts
// src/server/forms/form.repository.ts
import type { Form, FormStatus } from "@prisma/client";

export type FormSummary = {
  id: string;
  name: string;
  status: FormStatus;
  publishedVersionLabel: string; // siempre "Sin publicar" — TODO(form-publishing, RF-PUB-01): sustituir cuando exista FormVersion
  responseCount: number;          // siempre 0 — TODO(submissions-dashboard, RF-SUB-05): sustituir cuando exista Submission
  updatedAt: Date;
};

export function listFormsByOrganization(organizationId: string): Promise<FormSummary[]>;
// where: { organizationId, archivedAt: null }, orderBy: { updatedAt: "desc" } (CA-EDT-04, CA-EDT-06)

export function findFormById(organizationId: string, id: string): Promise<Form | null>;

export function createForm(
  organizationId: string,
  data: { name: string; draft: DraftForm },
): Promise<Form>;

export function updateFormName(organizationId: string, id: string, name: string): Promise<Form | null>;

export function updateFormDraft(organizationId: string, id: string, draft: DraftForm): Promise<Form | null>;

export function archiveForm(organizationId: string, id: string): Promise<Form | null>;
// set archivedAt: new Date(); null si no existe en esa organización
```

```ts
// src/server/forms/form.service.ts
import { NotFoundError } from "@/lib/errors"; // de tenancy-auth (#4)

export async function listForms(organizationId: string): Promise<FormSummary[]>;

/** Crea un Form con draft = { title: input.name, fields: [] } (RF-EDT-02,
 *  "formulario vacío"). */
export async function createForm(organizationId: string, input: CreateFormInput): Promise<Form>;

/** NotFoundError si sourceFormId no existe en organizationId. Copia el
 *  draft completo (mismos ids de campo: son únicos solo dentro del
 *  propio Form, no colisionan entre formularios distintos) con el
 *  nuevo nombre (CA-EDT-05). */
export async function duplicateForm(
  organizationId: string,
  input: DuplicateFormInput,
): Promise<Form>;

/** NotFoundError si id no existe en organizationId. */
export async function renameForm(organizationId: string, id: string, input: RenameFormInput): Promise<Form>;

/** Vuelve a validar con DraftFormSchema (defensa en profundidad: el
 *  cliente ya valida, pero el servidor no confía en él). ValidationError
 *  con los DraftFieldIssue si no es válido (RF-EDT-10); NotFoundError si
 *  id no existe en organizationId. */
export async function saveDraft(
  organizationId: string,
  id: string,
  input: SaveDraftInput,
): Promise<Form>;

/** NotFoundError si id no existe en organizationId. */
export async function archiveForm(organizationId: string, id: string): Promise<void>;
```

```ts
// src/server/forms/form.actions.ts
"use server";

export async function createFormAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; formId?: string }>;
// requireSession({ role: "admin" }); valida createFormSchema; formService.createForm

export async function duplicateFormAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; formId?: string }>;

export async function renameFormAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }>;

export async function archiveFormAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }>;

/** Llamada directamente desde el cliente (no ligada a un <form>), cada
 *  2 s sin cambios (debounce en useAutosaveDraft). Devuelve los
 *  DraftFieldIssue si el borrador no es válido, sin lanzar: la
 *  interfaz los usa para señalar el campo, no para mostrar un error
 *  genérico. */
export async function saveDraftAction(
  formId: string,
  draft: DraftForm,
): Promise<{ success: true } | { success: false; errors: DraftFieldIssue[] }>;
```

```ts
// src/hooks/use-form-editor-state.ts
export type FormEditorState = {
  title: string;
  fields: Field[];
  selectedFieldId: string | null;
};
export type FormEditorAction =
  | { type: "add-field"; field: Field; index?: number }
  | { type: "move-field"; fieldId: string; toIndex: number } // arrastre o teclado (CA-EDT-01, CA-EDT-08)
  | { type: "update-field"; fieldId: string; patch: Partial<Field> }
  | { type: "remove-field"; fieldId: string } // también limpia/avisa de visibleIf que lo referencien (CA-EDT-02)
  | { type: "duplicate-field"; fieldId: string }
  | { type: "select-field"; fieldId: string | null }
  | { type: "rename-title"; title: string };

export function useFormEditorState(initial: DraftForm): {
  state: FormEditorState;
  dispatch: (action: FormEditorAction) => void;
  fieldsReferencingId: (fieldId: string) => Field[]; // para el aviso de CA-EDT-02
};
```

```ts
// src/hooks/use-autosave-draft.ts
export type AutosaveStatus =
  | { phase: "idle" | "saving" | "saved" }
  | { phase: "invalid"; issues: DraftFieldIssue[] };

/** Debounce de 2000 ms (RF-EDT-08/CA-EDT-03) desde el último cambio de
 *  `draft`. Antes de llamar al servidor valida con DraftFormSchema en
 *  el cliente: si no es válido, pasa a "invalid" sin llamar al
 *  servidor; si es válido, llama a saveDraftAction y refleja su
 *  resultado (CA-EDT-07). */
export function useAutosaveDraft(formId: string, draft: DraftForm): AutosaveStatus;
```

### Páginas

| Ruta | Tipo | Responsabilidad |
| --- | --- | --- |
| `/admin/forms` | Server Component | `requireAdminPage()`; `formService.listForms(organizationId)`; `<FormsTable forms={forms} />`. |
| `/admin/forms/[id]` | Server Component | `requireAdminPage()`; `formService.findFormById` (vía repositorio) o `notFound()`; `<FormEditor form={form} />`. |

## Flujos

```mermaid
sequenceDiagram
  participant A as Administrador
  participant Canvas as FormCanvas
  participant Props as FieldPropertiesPanel
  participant Hook as useFormEditorState
  participant Auto as useAutosaveDraft
  participant Action as saveDraftAction
  participant Svc as form.service.ts

  A->>Canvas: Elimina el campo "¿Hay incidencias?"
  Canvas->>Hook: dispatch({ type: "remove-field", fieldId })
  Hook->>Hook: fieldsReferencingId(fieldId) -> ["Comentario"]
  Hook-->>A: aviso: "Comentario" dependía de este campo; se elimina su condición
  Hook->>Hook: limpia visibleIf de "Comentario"
  Hook->>Auto: nuevo draft
  Auto->>Auto: debounce 2000 ms, DraftFormSchema.safeParse
  Auto->>Action: saveDraftAction(formId, draft)
  Action->>Svc: saveDraft(organizationId, formId, { draft })
  Svc-->>Action: Form actualizado
  Action-->>Auto: { success: true }
  Auto-->>A: "Guardado" (CA-EDT-02, CA-EDT-03)
```

## Errores

| Error de dominio | HTTP (server actions: campo `error` devuelto, no HTTP) | Mensaje en la interfaz |
| --- | --- | --- |
| `UnauthorizedError` (de `requireSession`) | 401 | Redirige a `/login` (vía `requireAdminPage`). |
| `ForbiddenError` | 403 | Redirige a `/collect` (rol `collector` en `/admin`). |
| `NotFoundError` | 404 / `notFound()` | "No se ha encontrado el formulario." |
| `ValidationError` (borrador inválido) | — | El campo señalado en `field-properties-panel.tsx` con el mensaje de `DraftFieldIssue`; el indicador pasa a "No se puede guardar: revisa «<etiqueta del campo>»." (RF-EDT-10, CA-EDT-07) |

## Seguridad y privacidad

- Todas las consultas de `form.repository.ts` llevan `organizationId` (nunca solo `id`); `archiveForm`/`updateFormName`/`updateFormDraft` devuelven `null` si el `id` no pertenece a esa organización, que el servicio traduce a `NotFoundError` (nunca `ForbiddenError`, para no revelar que el recurso existe — mismo criterio que `CA-AUT-01` en `tenancy-auth`).
- `/admin/forms/**` queda bajo el `matcher` de `middleware.ts` de `tenancy-auth` (`/admin/:path*`); este módulo no añade protección propia, reutiliza `requireAdminPage`/`getCurrentOrg`.
- `Form.draftSchema` no contiene datos personales (es la definición del formulario, no respuestas); aun así, ningún log de este módulo imprime su contenido completo, solo ids y nombres (igual que `form-schema` con `FormVersion`).
- Sin integraciones externas ni archivos propios en este módulo (foto/firma/logo son de `file-storage`, fuera de alcance de #6).

## Tests

| Criterio / Requisito | Tipo | Fichero |
| --- | --- | --- |
| CA-EDT-04, RF-EDT-01, RF-EDT-02 | Vitest | `src/server/forms/form.service.test.ts` |
| CA-EDT-05 | Vitest | `src/server/forms/form.service.test.ts` |
| CA-EDT-06 | Vitest | `src/server/forms/form.service.test.ts` |
| CA-EDT-07, RF-EDT-10 | Vitest | `src/lib/form-editor/form-editor.schema.test.ts` (`DraftFormSchema`, `mapDraftIssuesToFields`) |
| RF-EDT-07 (integridad de `visibleIf`) | Vitest | `src/lib/form-editor/draft-integrity.test.ts` |
| CA-EDT-02 | Vitest | `src/hooks/use-form-editor-state.test.ts` (`fieldsReferencingId`, limpieza de `visibleIf` al eliminar) |
| — (filtro por organización) | Vitest | `src/server/forms/form.repository.test.ts` — `archiveForm`/`updateFormName` con `organizationId` de otra organización devuelven `null`. |
| CA-EDT-01 | Playwright | `e2e/form-editor-canvas.spec.ts` — arrastra el tercer campo a la primera posición, recarga, comprueba el orden. |
| CA-EDT-08 | Playwright | `e2e/form-editor-canvas.spec.ts` — mismo resultado moviendo con teclado (`Tab` hasta el campo, flechas). |
| CA-EDT-03, CA-EDT-07 | Playwright | `e2e/form-editor-autosave.spec.ts` — edita un campo, espera 2 s, comprueba "Guardado"; deja un `single_choice` sin opciones, espera 2 s, comprueba que señala el campo y no cambia a "Guardado". |
| CA-EDT-04, CA-EDT-05, CA-EDT-06 | Playwright | `e2e/form-editor-listing.spec.ts` — crear, duplicar y archivar desde `/admin/forms`. |

## Tareas de desarrollo

| Orden | Issue | Tarea | Depende de |
| --- | --- | --- | --- |
| 1 | #6 | `prisma/schema.prisma` (`Form`, `FormStatus`, relación en `Organization`) y migración `init_form_editor` | — |
| 2 | #6 | `src/lib/form-editor/draft-integrity.ts` + test | — |
| 3 | #6 | `src/lib/form-editor/form-editor.schema.ts` + test (depende de 2) | 2 |
| 4 | #6 | `src/lib/form-editor/default-theme.ts`, `src/lib/form-editor/field-palette.ts` | — |
| 5 | #6 | `src/server/forms/form.repository.ts` + test | 1 |
| 6 | #6 | `src/server/forms/form.service.ts` + test | 3, 5 |
| 7 | #6 | `src/server/forms/form.actions.ts` | 6 |
| 8 | #6 | Añadir `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`; componentes `shadcn/ui` que falten | — |
| 9 | #6 | `src/hooks/use-form-editor-state.ts` + test | 3 |
| 10 | #6 | `src/hooks/use-autosave-draft.ts` | 3, 7, 9 |
| 11 | #6 | `src/components/form-editor/field-palette.tsx`, `form-canvas.tsx` | 4, 8, 9 |
| 12 | #6 | `src/components/form-editor/field-properties-panel.tsx` | 9 |
| 13 | #6 | `src/components/form-editor/mobile-preview.tsx`, `autosave-indicator.tsx` | 4, 10 |
| 14 | #6 | `src/components/form-editor/form-editor.tsx` (orquesta 11-13, botón IA deshabilitado) | 10, 11, 12, 13 |
| 15 | #6 | `src/components/form-editor/forms-table.tsx` | 7, 8 |
| 16 | #6 | `src/app/admin/forms/page.tsx`, `src/app/admin/forms/[id]/page.tsx` | 6, 14, 15 |
| 17 | #6 | `e2e/form-editor-canvas.spec.ts`, `e2e/form-editor-autosave.spec.ts`, `e2e/form-editor-listing.spec.ts` | 16 |

## Historial de cambios

- 2026-11-17 — Diseño inicial (#6): modelo `Form` propio (sin `FormVersion`/`Submission`), `DraftFormSchema` sin mínimo de campos, editor con `@dnd-kit`, placeholders para tema real y asistente de IA.
