# Publicación y versiones — Diseño técnico

- **Requisitos:** [README.md](README.md)
- **Plan de pruebas:** [test-plan.md](test-plan.md)
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #26 (diseño), #38 (términos y condiciones), padre #23

## Resumen

Publicar convierte el borrador de un `Form` (`DraftForm`, ver `form-editor`) en una `FormVersion` inmutable y numerada, y deja al formulario en `status = published` con un `slug` estable y un modo de acceso (`registered` o `public`).

- **Un solo modelo nuevo, `FormVersion`**, y tres columnas nuevas en `Form`: `slug`, `accessMode`, `publishedVersion`.
- **Publicar** = en una transacción: validar el borrador como `FormVersion` de `form-schema`, crear la fila `FormVersion` (`version = máximo + 1`), y actualizar el `Form` (`status`, `slug` —se genera la primera vez y no cambia nunca—, `accessMode`, `publishedVersion`).
- **Despublicar** = `status = draft`; se conservan `slug`, versiones y `publishedVersion` (la última publicada). Volver a publicar crea una versión nueva con el mismo `slug`.
- **Cambiar el modo de acceso** es independiente de las versiones: no crea versión; surte efecto de inmediato en el enlace.
- **Las respuestas nunca se migran** (ver README, "Reglas"): cada una apunta a su `FormVersion`; este módulo ofrece leer cualquier versión por id.
- **Lectura sin sesión** (contrato para `field-collector` y `submissions-dashboard`): `getPublishedFormBySlug(slug)` y `getFormVersion(versionId)`. El control de acceso por modo lo aplica quien consume mediante `decideAccess` (lib pura); además, este módulo lo aplica en el endpoint `GET /api/public/forms/[slug]` y en la página `/f/[slug]`.
- **Interfaz**: un único componente `PublishPanel` que se monta en el editor con un cambio mínimo; el QR se sirve desde un route handler de administración.
- **Aplazado** (README, RF-PUB-07): el resumen de cambios entre versiones.

## Modelo de datos

```prisma
// prisma/schema.prisma — se añaden/modifican estos bloques

enum FormAccessMode {
  registered
  public
}

model Form {
  // ...campos existentes de form-editor (#6), sin cambios...
  slug             String?        @unique
  accessMode       FormAccessMode @default(registered)
  publishedVersion Int?           // número de la última versión publicada (se conserva al despublicar)

  versions FormVersion[]
}

model FormVersion {
  id              String   @id @default(cuid())
  formId          String
  organizationId  String
  version         Int
  schema          Json     // FormVersion de form-schema (schemaVersion, title, description, fields), inmutable
  publishedByUserId String?
  createdAt       DateTime @default(now())

  form Form @relation(fields: [formId], references: [id])

  @@unique([formId, version])
  @@index([organizationId, formId])
  @@map("form_versions")
}
```

- `Form.status` ya existe (`draft`/`published`); este módulo es el único que escribe `published`.
- `slug` es `null` hasta la primera publicación y no se reasigna jamás (el enlace es estable aunque se despublique o se cambie el nombre). `@unique` admite varios `null` en PostgreSQL.
- Una fila `FormVersion` **nunca se actualiza ni se borra**: el repositorio no expone `update` ni `delete` de versiones (RF-PUB-01); un test lo comprueba.
- `organizationId` se copia en `FormVersion` para poder filtrar sin unir tablas (regla de `CLAUDE.md`).
- `Submission` (submissions-dashboard) no tiene clave foránea a `FormVersion`; el campo `formVersionId` lo añadirá ese módulo (RF-PUB-03).
- Migración: `add_form_publishing` (`npx prisma migrate dev --name add_form_publishing`). Compatible con los formularios existentes (RNF-PUB-03): todas las columnas nuevas son opcionales o tienen valor por defecto.

## Estructura de ficheros

| Capa | Ruta | Responsabilidad |
| --- | --- | --- |
| Modelo | `prisma/schema.prisma` (modificar) + migración `add_form_publishing` | `FormAccessMode`, columnas de `Form`, `FormVersion`. |
| Lógica pura | `src/lib/form-publishing/slug.ts` | `generateSlug`, `isValidSlug`, `SLUG_REGEX`. |
| Lógica pura | `src/lib/form-publishing/access.ts` | `decideAccess`: decide si un usuario (o nadie) puede rellenar el formulario según el modo. |
| Lógica pura | `src/lib/form-publishing/form-link.ts` | `buildFormLink(baseUrl, slug)`. |
| Lógica pura | `src/lib/form-publishing/qr.ts` | `renderQr(url, format)` → PNG (`Buffer`) o SVG (`string`). |
| Esquema | `src/lib/form-publishing/form-publishing.schema.ts` | `AccessModeSchema`, `publishFormSchema`, `setAccessModeSchema`, `qrQuerySchema`, tipos. |
| Repositorio | `src/server/form-publishing/form-publishing.repository.ts` | Consultas Prisma de `FormVersion` y de las columnas de publicación de `Form`. |
| Servicio | `src/server/form-publishing/form-publishing.service.ts` | Publicar, despublicar, cambiar modo, estado de publicación y las lecturas del contrato. |
| Entrada | `src/server/form-publishing/form-publishing.actions.ts` | Server actions de administración. |
| Entrada | `src/app/api/public/forms/[slug]/route.ts` | `GET`: definición para rellenar, con control de acceso por modo. |
| Entrada | `src/app/api/forms/[id]/qr/route.ts` | `GET`: imagen del QR (PNG o SVG), solo admin. |
| Interfaz | `src/app/f/[slug]/page.tsx` | Página del enlace: cerrado / no existe / login requerido / marcador del relleno (lo sustituirá `field-collector`). |
| Componentes | `src/components/form-publishing/publish-panel.tsx` | Botón Publicar/Republicar, selector de modo, enlace con "copiar", QR con descargas, Despublicar. |
| Editor | `src/app/admin/forms/[id]/page.tsx` y `src/components/form-editor/form-editor.tsx` (modificar, mínimo) | La página carga el estado de publicación y el editor monta `<PublishPanel>` en su barra superior. |
| Editor | `src/server/forms/form.repository.ts` (modificar) | `listFormsByOrganization` calcula `publishedVersionLabel` real (ver abajo). |
| Config | `.env.example` | Sin variables nuevas: el enlace usa `AUTH_URL` (ya existe, ver `src/lib/env.ts`). |

**Dependencia nueva de npm (pendiente de aprobación del arquitecto, ver pregunta 1):** `qrcode` (+ `@types/qrcode` en desarrollo) para generar el PNG y el SVG. Sin ella habría que escribir un codificador QR propio. Componentes shadcn a usar: los que ya existen (`button`, `badge`, `dialog`, `alert-dialog`, `select`, `label`, `input`); no hace falta añadir ninguno.

## Contratos

### Lógica pura

```ts
// src/lib/form-publishing/slug.ts
export const SLUG_LENGTH = 10;
/** Alfabeto sin caracteres ambiguos (sin 0 o 1 l i): "abcdefghjkmnpqrstuvwxyz23456789" (31 símbolos). */
export const SLUG_REGEX: RegExp; // /^[a-hjkmnp-z2-9]{10}$/
/** 10 símbolos con `crypto.randomInt(0, 31)` de node:crypto (≈ 49,5 bits). */
export function generateSlug(): string;
export function isValidSlug(value: string): boolean;
```

```ts
// src/lib/form-publishing/access.ts
import type { FormAccessMode } from "@prisma/client";

export type AccessDecision = "allow" | "login-required" | "forbidden";

/** `public` -> "allow" siempre.
 *  `registered`: sin usuario -> "login-required"; usuario de otra organización -> "forbidden";
 *  usuario de la organización del formulario (admin o collector) -> "allow". */
export function decideAccess(
  accessMode: FormAccessMode,
  formOrganizationId: string,
  user: { organizationId: string } | null,
): AccessDecision;
```

```ts
// src/lib/form-publishing/form-link.ts
/** `${baseUrl sin barra final}/f/${slug}`. */
export function buildFormLink(baseUrl: string, slug: string): string;
```

```ts
// src/lib/form-publishing/qr.ts
export type QrFormat = "png" | "svg";
/** PNG: Buffer (cabecera 89 50 4E 47), 512 px de ancho, margen de 2 módulos, corrección "M".
 *  SVG: string que empieza por "<svg". */
export function renderQr(url: string, format: "png"): Promise<Buffer>;
export function renderQr(url: string, format: "svg"): Promise<string>;
```

### Esquemas Zod

```ts
// src/lib/form-publishing/form-publishing.schema.ts
import { z } from "zod";

export const AccessModeSchema = z.enum(["registered", "public"]);
export type AccessMode = z.infer<typeof AccessModeSchema>;

export const publishFormSchema = z.object({ accessMode: AccessModeSchema });
export type PublishFormInput = z.infer<typeof publishFormSchema>;

export const setAccessModeSchema = z.object({ accessMode: AccessModeSchema });
export type SetAccessModeInput = z.infer<typeof setAccessModeSchema>;

export const qrQuerySchema = z.object({
  format: z.enum(["png", "svg"]).default("png"),
  download: z.enum(["1"]).optional(),
});
```

### Tipos de lectura (contrato con otros módulos)

```ts
// src/server/form-publishing/form-publishing.service.ts
import type { FormVersion as FormSchemaVersion, ThemeSnapshot } from "@/lib/form-schema";

export type PublishedFormView = {
  formId: string;
  organizationId: string;
  name: string;
  slug: string;
  accessMode: AccessMode;
  versionId: string;
  version: number;
  schema: FormSchemaVersion; // validado con FormVersionSchema al leer
  theme: ThemeSnapshot;      // DEFAULT_THEME hasta que exista `theming` (TODO(theming))
};

export type FormLookup =
  | { state: "published"; form: PublishedFormView }
  | { state: "closed" };      // despublicado o archivado: solo eso, sin datos del formulario

export type StoredFormVersion = {
  id: string;
  formId: string;
  organizationId: string;
  version: number;
  schema: FormSchemaVersion;
  createdAt: Date;
};

export type PublishingState = {
  status: "draft" | "published";
  slug: string | null;
  accessMode: AccessMode;
  publishedVersion: number | null;
  link: string | null;       // buildFormLink(env.AUTH_URL, slug) si hay slug
};

export class PublishValidationError extends ValidationError {
  constructor(public readonly issues: { path: string; message: string }[]);
}
```

`ValidationError`, `NotFoundError`, `ConflictError`, `UnauthorizedError` y `ForbiddenError` son los de `src/lib/errors.ts`.

### Repositorio

```ts
// src/server/form-publishing/form-publishing.repository.ts
// Administración: siempre con organizationId. Sin update/delete de FormVersion.

export function findFormForPublishing(organizationId: string, formId: string):
  Promise<Form | null>; // where { id, organizationId, archivedAt: null }

/** Transacción. Dentro de la transacción se lee el Form con `organizationId` (si no existe,
 *  devuelve null). Si ya tiene `slug`, se conserva y se IGNORA el recibido; si no, se escribe
 *  el recibido. Así dos primeras publicaciones concurrentes nunca reasignan el slug.
 *  Calcula version = (max(version) del formId) + 1 dentro de la transacción,
 *  crea la FormVersion y actualiza el Form. Lanza ConflictError si choca
 *  @@unique([formId, version]) (publicación concurrente). Si choca el
 *  @@unique del slug lanza `SlugTakenError` (interno) para que el servicio reintente. */
export function createVersionAndPublish(
  organizationId: string,
  formId: string,
  data: { schema: FormSchemaVersion; accessMode: AccessMode; slug: string; userId: string },
): Promise<{ form: Form; version: FormVersion } | null>; // null si el form no es de la organización

export function setUnpublished(organizationId: string, formId: string): Promise<Form | null>;
export function setAccessMode(organizationId: string, formId: string, accessMode: AccessMode): Promise<Form | null>;
export function findVersion(organizationId: string, formId: string, version: number): Promise<FormVersion | null>;

// Lectura sin sesión (sin organizationId: se llega por slug o por id de versión)
export function findFormBySlug(slug: string): Promise<Form | null>;
export function findVersionById(versionId: string): Promise<FormVersion | null>;
```

### Servicio

```ts
/** Cubre: RF-PUB-01, RF-PUB-09, RF-PUB-11, CA-PUB-01, CA-PUB-05, CA-PUB-07.
 *  1. findFormForPublishing; null -> NotFoundError("No se ha encontrado el formulario.").
 *  2. Valida form.draftSchema con DraftFormSchema y construye
 *     { schemaVersion: CURRENT_SCHEMA_VERSION, title, description, fields } (sin `theme`)
 *     y lo valida con FormVersionSchema. Si falla (p. ej. 0 campos) -> PublishValidationError
 *     con `issues` { path: "fields.2.visibleIf.fieldId", message }. Mensaje para 0 campos:
 *     "El formulario necesita al menos un campo para publicarse."
 *  3. slug = form.slug ?? generateSlug(); si createVersionAndPublish lanza SlugTakenError,
 *     reintenta con otro slug (máx. 5 veces; después, lanza el error).
 *  4. Devuelve { version, slug, link }. */
export function publishForm(
  organizationId: string, userId: string, formId: string, input: PublishFormInput,
): Promise<{ version: number; slug: string; link: string }>;

/** status = draft. Si ya estaba en draft, no hace nada (idempotente). NotFoundError si no es de la organización.
 *  Cubre: RF-PUB-06, CA-PUB-05, CA-PUB-06 */
export function unpublishForm(organizationId: string, formId: string): Promise<void>;

/** Cambia accessMode sin crear versión. Permitido también en draft (se aplicará al publicar).
 *  NotFoundError si no es de la organización. Cubre: RF-PUB-09, CA-PUB-05 */
export function setFormAccessMode(organizationId: string, formId: string, input: SetAccessModeInput): Promise<void>;

/** Para el panel. NotFoundError si no es de la organización. */
export function getPublishingState(organizationId: string, formId: string): Promise<PublishingState>;

/** Contrato de lectura (sin sesión). Cubre: RF-PUB-04, RF-PUB-10
 *  - slug inexistente o con formato inválido -> NotFoundError.
 *  - form.status = draft o archivedAt != null -> { state: "closed" }.
 *  - si no -> { state: "published", form } con la versión form.publishedVersion. */
export function getPublishedFormBySlug(slug: string): Promise<FormLookup>;

/** Igual que getPublishedFormBySlug, pero además aplica decideAccess:
 *  "login-required" -> UnauthorizedError; "forbidden" -> ForbiddenError.
 *  El cierre ({state:"closed"}) se evalúa antes que el acceso (no revela nada).
 *  Cubre: CA-PUB-04. */
export function getFormForFilling(
  slug: string, user: { organizationId: string } | null,
): Promise<FormLookup>;

/** Cualquier versión por id (RF-PUB-03, RF-PUB-08), con independencia del estado actual del
 *  formulario. null si no existe. `schema` se valida con FormVersionSchema. Sin control de acceso:
 *  quien la consume aplica decideAccess con `formId`/`organizationId`. El consumidor que recibe
 *  una respuesta en cola comprueba que `version.formId` coincide con el formulario esperado. */
export function getFormVersion(versionId: string): Promise<StoredFormVersion | null>;
```

### Entrada: server actions (`form-publishing.actions.ts`, `"use server"`)

Todas empiezan con `requireSession({ role: "admin" })` y usan `user.organizationId`. Devuelven un resultado, no lanzan por errores de negocio; `NotFoundError` -> `{ error: "No se ha encontrado el formulario." }`.

```ts
export type PublishActionResult =
  | { ok: true; version: number; slug: string; link: string }
  | { ok: false; error: string; issues?: { path: string; message: string }[] };

/** Valida con publishFormSchema; PublishValidationError -> { ok:false, error, issues };
 *  ConflictError -> { ok:false, error:"Se está publicando desde otro lugar. Inténtalo de nuevo." }.
 *  revalidatePath("/admin/forms") y `/admin/forms/${formId}`. */
export async function publishFormAction(formId: string, input: PublishFormInput): Promise<PublishActionResult>;
export async function unpublishFormAction(formId: string): Promise<{ ok: true } | { ok: false; error: string }>;
export async function setAccessModeAction(formId: string, input: SetAccessModeInput): Promise<{ ok: true } | { ok: false; error: string }>;
```

### Entrada: route handlers

| Método y ruta | Quién | Respuestas |
| --- | --- | --- |
| `GET /api/public/forms/[slug]` | Cualquiera (sesión opcional: `getCurrentUser()`) | **200** `PublishedFormView` en JSON (sin `organizationId`: solo `formId`, `name`, `slug`, `accessMode`, `versionId`, `version`, `schema`, `theme`). **401** `{ error: "login-required" }` (modo `registered` sin sesión). **403** `{ error: "forbidden" }` (sesión de otra organización). **404** `{ error: "not-found" }` (slug desconocido o formato inválido). **410** `{ error: "closed", message: "Este formulario ya no acepta respuestas." }` (despublicado o archivado). Cabecera `Cache-Control: no-store`. |
| `GET /api/forms/[id]/qr?format=png\|svg&download=1` | Admin (`requireSession({role:"admin"})`) | **200** imagen (`image/png` o `image/svg+xml`); con `download=1`, `Content-Disposition: attachment; filename="<slug>.png"` (o `.svg`). **400** parámetros inválidos. **401/403** sin sesión / no admin. **404** formulario de otra organización, sin `slug` o no publicado. |

`/api/**` y `/f/**` quedan fuera del `matcher` del middleware (solo guarda `/admin` y `/collect`), así que la autenticación de estas rutas es la que hace cada handler.

El route handler del QR declara `export const runtime = "nodejs"` (la librería `qrcode` no es compatible con edge). Dependencia nueva aprobada: `qrcode` y `@types/qrcode`, con la versión fijada en `package.json`; comprobar que el build de Next.js pasa.

El `qr` apunta a `buildFormLink(loadEnv().AUTH_URL, slug)`.

### Página `/f/[slug]` (`src/app/f/[slug]/page.tsx`, Server Component, `dynamic = "force-dynamic"`)

Llama a `getFormForFilling(slug, await getCurrentUser())` y:
- `NotFoundError` -> `notFound()`.
- `UnauthorizedError` -> `redirect("/login")`. (El retorno tras el login queda para `field-collector`, ver pregunta 3.)
- `ForbiddenError` -> mensaje "No tienes acceso a este formulario. Entra con una cuenta de la organización que lo ha publicado." con estado 200 (sin `notFound`, el formulario existe); sin datos del formulario.
- `{ state: "closed" }` -> texto exacto **"Este formulario ya no acepta respuestas"**.
- `{ state: "published" }` -> marcador mínimo: el título del formulario y "Rellenado disponible próximamente" (`data-testid="fill-placeholder"`); `field-collector` sustituye este bloque por la pantalla real.

### Interfaz: `PublishPanel`

```ts
// src/components/form-publishing/publish-panel.tsx ("use client")
export function PublishPanel(props: {
  formId: string;
  initialState: PublishingState;
  /** false mientras el autoguardado del editor no haya terminado o el borrador no sea válido */
  canPublish: boolean;
}): JSX.Element;
```

- Muestra una insignia de estado: "Borrador", "Publicado v<n>" o "Despublicado" (draft con `slug`). El aviso de cambios sin publicar queda para la segunda iteración (con RF-PUB-07).
- Selector `accessMode` con dos opciones y texto de ayuda: "Solo usuarios registrados" / "Público con enlace". `data-testid="access-mode"`. En un formulario publicado, cambiarlo llama a `setAccessModeAction` al momento; en uno sin publicar, se envía con el botón Publicar.
- Botón `data-testid="publish-button"`: "Publicar" la primera vez, "Publicar cambios" si ya está publicado. Deshabilitado si `!canPublish`. Al pulsar, `publishFormAction`; si falla con `issues`, los lista bajo el botón; si va bien, actualiza el estado local.
- Cuando hay `link`: campo de solo lectura con el enlace (`data-testid="form-link"`), botón "Copiar enlace", imagen del QR (`<img src="/api/forms/<id>/qr?format=png">`) y enlaces "Descargar PNG" y "Descargar SVG" (`?download=1`).
- "Despublicar" (`AlertDialog` de confirmación, `data-testid="unpublish-button"`) solo si está publicado.
- El autoguardado espera 2 s tras el último cambio; si se publicara antes, se publicaría un borrador viejo. Por eso `useAutosaveDraft` (`src/hooks/use-autosave-draft.ts`, modificar) devuelve además `isPending: boolean`: `true` desde que cambia el borrador hasta que termina su guardado (con éxito o con error). `FormEditor` pasa `canPublish = !isPending && status.phase !== "saving" && status.phase !== "invalid" && status.phase !== "error"`. Con `phase === "error"` el servidor tiene un borrador viejo y publicar publicaría algo distinto de lo que ve el admin (la versión es inmutable), así que el panel, con `phase === "error"`, muestra bajo el botón (`data-testid="publish-blocked"`) "No se pudo guardar el borrador; reinténtalo antes de publicar". El estado inicial (`idle`, sin cambios) permite publicar. Cubre RF-PUB-01.

### Cambio en el listado de `form-editor`

`listFormsByOrganization` calcula `publishedVersionLabel`: `"Sin publicar"` si `publishedVersion` es `null`; `"v<n>"` si `status = published`; `"Despublicado (última v<n>)"` si `status = draft` y `publishedVersion` no es `null`. Se retira el `TODO(form-publishing, RF-PUB-01)`. El `TODO` del recuento de respuestas se queda (lo cierra `submissions-dashboard`). Hay que actualizar `form.repository.test.ts` de `form-editor` para el nuevo cálculo.

## Flujos

**Publicar** (admin, panel): `PublishPanel` -> `publishFormAction(formId, { accessMode })` -> `requireSession(admin)` -> `publishFormSchema` -> `publishForm` -> valida borrador -> transacción (`FormVersion` + `Form`) -> `revalidatePath` -> el panel muestra enlace y QR.

**Rellenar** (cualquiera con el enlace): `/f/<slug>` -> `getFormForFilling(slug, sesión)` -> `closed` / `published` / error de acceso. La definición vía API (`GET /api/public/forms/<slug>`) devuelve lo mismo en JSON.

**Cambio posterior**: el admin edita el borrador (v1 sigue sirviéndose) -> "Publicar cambios" -> v2; el enlace sirve v2; `getFormVersion(<id de v1>)` sigue devolviendo v1 íntegra (CA-PUB-01, CA-PUB-03).

**Despublicar y republicar**: `status = draft`, `/f/<slug>` y la API responden "cerrado"/410; al republicar, mismo `slug`, versión nueva (CA-PUB-06).

## Errores

| Situación | Error de dominio | Server action | HTTP (route handler) |
| --- | --- | --- | --- |
| Formulario de otra organización, archivado o inexistente (administración) | `NotFoundError` | `{ ok:false, error:"No se ha encontrado el formulario." }` | 404 |
| Borrador no publicable (0 campos, condición inválida) | `PublishValidationError` | `{ ok:false, error, issues }` | — |
| Dos publicaciones simultáneas | `ConflictError` | `{ ok:false, error:"Se está publicando desde otro lugar. Inténtalo de nuevo." }` | — |
| Sin sesión / no admin | `UnauthorizedError` / `ForbiddenError` | las lanza `requireSession` | 401 / 403 |
| Formulario `registered` sin sesión | `UnauthorizedError` | — | 401 |
| Formulario `registered`, sesión de otra organización | `ForbiddenError` | — | 403 |
| `slug` desconocido o con formato inválido | `NotFoundError` | — | 404 |
| Formulario despublicado o archivado | `{ state: "closed" }` | — | 410 |
| Parámetros de QR inválidos | `ZodError` | — | 400 |

## Seguridad y privacidad

- Administración: `organizationId` en cada consulta y en el `where` de cada escritura (`updateMany`/`create` con la organización de la sesión); un `formId` ajeno devuelve `null` en el repositorio y `NotFoundError` en el servicio (404, nunca 403, para no revelar su existencia).
- Lectura pública: solo por `slug` (≈ 50 bits, `crypto.randomInt`) o por id de versión (`cuid`). La respuesta de la API no incluye `organizationId` ni datos de usuarios. La lectura sin sesión de `getFormVersion` es solo para código del servidor; no hay endpoint HTTP que sirva una versión por id sin control de acceso.
- Un formulario `public` es un vector de abuso; la limitación de tasa y el anti-spam de la recepción son de `field-collector`. La lectura (`GET /api/public/forms/[slug]`) no tiene limitación en el piloto: la definición es pública por diseño en modo `public`.
- Nada de contenido de respuestas ni datos personales en logs; este módulo no maneja respuestas.
- `Cache-Control: no-store` en la API para que despublicar o cambiar el modo surta efecto al momento.

## Tests

Nombre de cada test: incluye el identificador del criterio (`CA-PUB-0N`) para poder ejecutarlo con `-t`.

Unitarios (Vitest, sin base de datos):

| Fichero | Qué comprueba |
| --- | --- |
| `src/lib/form-publishing/slug.test.ts` | Longitud 10, solo alfabeto permitido, 1000 slugs sin repetirse, `isValidSlug` rechaza mayúsculas, `0`, `1`, `l`, `i`, longitud incorrecta. (RNF-PUB-01) |
| `src/lib/form-publishing/access.test.ts` | Tabla de decisión completa: `public` con y sin usuario; `registered` sin usuario (`login-required`), de otra organización (`forbidden`), de la misma (`allow`). **CA-PUB-04** |
| `src/lib/form-publishing/form-link.test.ts` | Con y sin barra final en `baseUrl`. **CA-PUB-02** |
| `src/lib/form-publishing/qr.test.ts` | PNG empieza por `89 50 4E 47`; SVG empieza por `<svg`; codificar dos URLs distintas da salidas distintas. **CA-PUB-02** |
| `src/lib/form-publishing/form-publishing.schema.test.ts` | Modos válidos e inválidos; `qrQuerySchema` por defecto `png`, rechaza `gif`. |

Integración (Vitest, requieren PostgreSQL; crean sus propias organizaciones y borran lo suyo al terminar):

| Fichero | Qué comprueba |
| --- | --- |
| `src/server/form-publishing/form-publishing.repository.test.ts` | Aislamiento: con el `organizationId` de B, `findFormForPublishing`, `createVersionAndPublish`, `setUnpublished`, `setAccessMode` y `findVersion` sobre el form de A devuelven `null` y no cambian nada (**CA-PUB-05**); el módulo no exporta función alguna que actualice o borre `FormVersion` (RF-PUB-01); `version` crece 1, 2, 3; conflicto de `@@unique([formId, version])`; dos `createVersionAndPublish` seguidos con slugs distintos dejan el primero (el segundo lo ignora). |
| `src/hooks/use-autosave-draft.test.ts` o test del editor | `canPublish` es `false` con `isPending`, `saving`, `invalid` y `error` (**RF-PUB-01**). |
| `src/server/form-publishing/form-publishing.service.test.ts` | **CA-PUB-01**: publicar v1, cambiar una etiqueta del borrador, publicar v2 -> existe v2 con la etiqueta nueva y `getFormVersion(v1.id)` conserva la etiqueta antigua. **CA-PUB-03**: v2 con un campo obligatorio nuevo; el esquema de v1 no lo contiene y sigue validando con `FormVersionSchema`; una respuesta de ejemplo de v1 sigue pasando `validateSubmission` de form-schema contra v1. **CA-PUB-04**: `getFormForFilling` con modo `registered` sin usuario lanza `UnauthorizedError`, con usuario de otra organización `ForbiddenError`, con usuario de la organización devuelve el formulario; con `public` y sin usuario lo devuelve. **CA-PUB-05**: publicar, despublicar y cambiar modo con el `organizationId` de B lanza `NotFoundError`. **CA-PUB-06**: despublicar -> `getPublishedFormBySlug` devuelve `{state:"closed"}`; republicar conserva el `slug` y da `version` 2. **CA-PUB-07**: borrador sin campos -> `PublishValidationError`, ninguna `FormVersion` creada. Además: el modo por defecto es `registered`; archivar un formulario publicado lo vuelve `closed`; slug desconocido -> `NotFoundError`; cambiar el modo no crea versión; el `slug` no cambia al renombrar ni al republicar. |
| `src/server/forms/form.repository.test.ts` (modificar) | Etiquetas "Sin publicar", "v<n>" y "Despublicado (última v<n>)". |

Extremo a extremo (Playwright; helpers en `e2e/helpers/form-publishing.ts`: `login`, `seedForm` de `e2e/helpers/form-editor.ts`, y `publishViaService(formId, accessMode)` que llama al servicio con el admin del seed):

| Fichero | Qué comprueba |
| --- | --- |
| `e2e/form-publishing-panel.spec.ts` | `CA-PUB-01`/`CA-PUB-02`: el admin abre el editor, pulsa Publicar, aparece el enlace y el QR (`<img>` con `naturalWidth > 0`); la ruta del QR devuelve `image/png` y `image/svg+xml`; abre `/f/<slug>` y ve `fill-placeholder`. `CA-PUB-06`: despublica, `/f/<slug>` muestra "Este formulario ya no acepta respuestas"; republica, el mismo enlace vuelve a funcionar. `CA-PUB-07`: con un borrador sin campos el panel muestra el mensaje de error y no aparece enlace. `RF-PUB-01`: si el autoguardado falla (se fuerza con `page.route` devolviendo 500 al guardado), `publish-button` queda deshabilitado y `publish-blocked` muestra "No se pudo guardar el borrador; reinténtalo antes de publicar". |
| `e2e/form-publishing-api.spec.ts` | `CA-PUB-04`: con `request` sin cookies, `GET /api/public/forms/<slug>` da 401 en modo `registered` y 200 con `schema` en `public`; con la sesión del admin da 200 en `registered`; despublicado da 410; slug inexistente 404. `CA-PUB-05`: el QR de un formulario de otra organización con la sesión del admin demo da 404 (se crea la otra organización con `createOrganization`). |

## Términos y condiciones en formularios públicos (#38)

Añade la aceptación obligatoria de términos y condiciones a los formularios `public`. Cubre RF-PUB-12 a RF-PUB-15, RNF-PUB-04, CA-PUB-08 a CA-PUB-11 y, de otros módulos, RF-COL-21, RF-COL-22, RF-SUB-13, RF-GDPR-06 y RF-GDPR-07. **Depende de #33** (pantalla de relleno y `submitFill`, aún no fusionados cuando se escribe este diseño): el desarrollo parte de una rama que ya los contenga.

### Decisiones

1. **Dónde se configura: en cada publicación del formulario, no en la organización.** Dos enlaces `https` (términos y privacidad) más una declaración del administrador. Los guarda la `FormVersion` (`consent`, JSON nulable): así "versión del texto" = versión del formulario y no hace falta otra tabla ni otra pantalla de ajustes. El panel rellena los enlaces con los de la última publicación para no reescribirlos. Una configuración por organización queda como mejora posible (pregunta 1).
2. **Enlaces, no texto.** FormIA no aloja el texto legal de cada cliente (RNF-PUB-04); se enlaza.
3. **Dos aceptaciones distintas.** (a) El **administrador** declara al publicar (guardada en la versión: `declaredByUserId`, `declaredAt`); (b) la **persona que rellena** marca la casilla (guardada en cada `Submission`). Ver pregunta 2 sobre la interpretación de "casilla que tendrá que rellenar la empresa cliente".
4. **Sin términos no se publica en `public`**, y un `public` ya publicado sin términos queda cerrado (RF-PUB-14) hasta republicar. Es la opción segura y no requiere cambios en #33: reutiliza el estado `closed` (410).
5. **`accessMode` sigue sin crear versión**, pero `registered → public` solo se permite si la versión publicada ya lleva términos; si no, hay que "Publicar cambios" con ellos.
6. La casilla y los avisos de la pantalla de relleno se definen aquí porque el recorrido cruza tres módulos; los criterios del lado de relleno (CA-COL-11, CA-COL-12) y de la respuesta (CA-SUB-15) se ejecutan en el plan de este módulo.

### Modelo de datos (migración `add_consent_terms`)

```prisma
model FormVersion {
  // ...campos existentes sin cambios...
  consent Json? // StoredConsent; null si se publicó en modo registered o antes de #38. Inmutable con la versión.
}

model Submission {
  // ...campos existentes sin cambios...
  consent Json? // SubmissionConsent (ver submissions-dashboard); null en formularios registered y en respuestas anteriores a #38
}
```

Migración solo `ALTER TABLE form_versions ADD COLUMN consent JSONB` y `ALTER TABLE submissions ADD COLUMN consent JSONB` (sin `NOT NULL` ni backfill). Efecto conocido: los formularios `public` ya publicados pasan a "cerrado" hasta republicarse con términos (RF-PUB-14); en el piloto no hay clientes reales (anotarlo en la PR).

### Ficheros

| Capa | Ruta | Cambio |
| --- | --- | --- |
| Modelo | `prisma/schema.prisma` + migración `add_consent_terms` | `FormVersion.consent`, `Submission.consent`. |
| Validación | `src/lib/form-publishing/consent.schema.ts` (nuevo) | `HttpsUrlSchema`, `ConsentInputSchema`, `StoredConsentSchema`, tipos. |
| Validación | `src/lib/form-publishing/form-publishing.schema.ts` (modificar) | `publishFormSchema` gana `consent` y la regla "público exige términos". |
| Pruebas | `src/lib/form-publishing/consent.fixtures.ts` (nuevo) | `TEST_CONSENT_INPUT` para los tests y e2e que publican en `public`. |
| Repositorio | `src/server/form-publishing/form-publishing.repository.ts` (modificar) | `createVersionAndPublish` guarda `consent`; `findFormBySlug` incluye `organization.name`; nueva `findLatestConsentVersion`. |
| Servicio | `src/server/form-publishing/form-publishing.service.ts` (modificar) | `publishForm`, `setFormAccessMode`, `getPublishingState`, `getPublishedFormBySlug`, `getFormVersion`. |
| Entrada | `src/server/form-publishing/form-publishing.actions.ts` (modificar) | `publishFormAction` traduce `ZodError` a `issues`. |
| Entrada | `src/app/api/public/forms/[slug]/route.ts` (modificar) | Añade `consent` y `organizationName` al JSON. |
| Interfaz | `src/components/form-publishing/publish-panel.tsx` (modificar) | Campos de términos y declaración. |
| Interfaz | `src/components/form-publishing/consent-fields.tsx` (nuevo) | Subcomponente de esos campos. |
| Relleno | `src/components/field-collector/consent-checkbox.tsx` (nuevo), `fill-form.tsx` (modificar, de #33) | Casilla, enlaces y aviso del encargado. |
| Relleno | `src/lib/field-collector/fill.schema.ts`, `src/lib/field-collector/submit.ts`, `src/server/field-collector/fill.service.ts` (modificar, de #33) | `acceptedTerms` y comprobación en servidor. |
| Respuestas | `src/lib/submissions-dashboard/create-submission.schema.ts`, `src/server/submissions/submission.service.ts`, `submission.repository.ts` (modificar) | Guardan `consent`. |
| Respuestas | `src/components/submissions-dashboard/submission-consent.tsx` (nuevo), `submission-detail.tsx` (modificar) | Muestra la prueba en la ficha. |
| Pruebas | `e2e/helpers/form-publishing.ts` (modificar) | `publishViaService(formId, accessMode)` pasa `TEST_CONSENT_INPUT` si el modo es `public`. |

### Contratos

```ts
// src/lib/form-publishing/consent.schema.ts
import { z } from "zod";

export const MAX_CONSENT_URL_LENGTH = 2048;

/** Texto recortado; https obligatorio; sin usuario ni contraseña; hasta 2048 caracteres.
 *  Mensajes (es): "Introduce un enlace válido.", "El enlace debe empezar por https://.", "El enlace es demasiado largo." */
export const HttpsUrlSchema: z.ZodType<string>;

export const ConsentInputSchema = z.object({
  termsUrl: HttpsUrlSchema,
  privacyUrl: HttpsUrlSchema,
  /** Casilla del administrador; debe ser exactamente `true`. Mensaje: "Debes confirmar la declaración para publicar." */
  publisherDeclaration: z.literal(true),
});
export type ConsentInput = z.infer<typeof ConsentInputSchema>;

/** Lo que guarda FormVersion.consent. */
export const StoredConsentSchema = z.object({
  termsUrl: HttpsUrlSchema,
  privacyUrl: HttpsUrlSchema,
  declaredByUserId: z.string().min(1),
  declaredAt: z.string().datetime(), // hora del servidor al publicar
});
export type StoredConsent = z.infer<typeof StoredConsentSchema>;

/** Lo que ve quien rellena (nunca declaredBy*). */
export type PublicConsent = { termsUrl: string; privacyUrl: string };
export function toPublicConsent(c: StoredConsent): PublicConsent;
/** Parsea con StoredConsentSchema; null si es null o no es válido (nunca lanza). */
export function parseStoredConsent(raw: unknown): StoredConsent | null;
```

```ts
// src/lib/form-publishing/form-publishing.schema.ts (modificar)
export const publishFormSchema = z
  .object({ accessMode: AccessModeSchema, consent: ConsentInputSchema.optional() })
  .superRefine((value, ctx) => {
    if (value.accessMode === "public" && !value.consent) {
      ctx.addIssue({ code: "custom", path: ["consent"], message: "Un formulario público necesita términos y condiciones." });
    }
  });
// Con accessMode "registered", `consent` se ignora (no se guarda).
// setAccessModeSchema no cambia.
```

```ts
// Repositorio
export function createVersionAndPublish(
  organizationId: string, formId: string,
  data: { schema: FormSchemaVersion; accessMode: AccessMode; slug: string; userId: string; consent: StoredConsent | null },
): Promise<{ form: Form; version: FormVersion } | null>; // guarda FormVersion.consent = data.consent

/** Última FormVersion de ese formulario con consent no nulo (para rellenar el panel). null si no hay. */
export function findLatestConsentVersion(organizationId: string, formId: string): Promise<FormVersion | null>;

export function findFormBySlug(slug: string): Promise<(Form & { organization: { name: string } }) | null>;
```

```ts
// Servicio: tipos que cambian
export type PublishedFormView = {
  // ...campos existentes...
  organizationName: string;
  /** null en modo registered. En modo public siempre hay valor (si no, el formulario se trata como cerrado). */
  consent: PublicConsent | null;
};

export type StoredFormVersion = {
  // ...campos existentes...
  consent: StoredConsent | null;
};

export type PublishingState = {
  // ...campos existentes...
  /** Términos de la versión publicada actual (null si no tiene). Decide si `registered → public` se puede hacer sin republicar. */
  consent: PublicConsent | null;
  /** Términos de la última versión que los tuvo (para rellenar el panel). */
  suggestedConsent: PublicConsent | null;
};
```

Cambios de comportamiento del servicio:

- `publishForm`: tras validar el borrador (paso 2), si `accessMode === "public"` y `input.consent` falta o no pasa `ConsentInputSchema` → `PublishValidationError` con `issues` `{ path: "consent.termsUrl" | "consent.privacyUrl" | "consent.publisherDeclaration" | "consent", message }`; no se crea nada. Si pasa: `consent = { termsUrl, privacyUrl, declaredByUserId: userId, declaredAt: new Date().toISOString() }`. En `registered`, `consent = null`. El resto del flujo no cambia. Cubre RF-PUB-12, RF-PUB-13, CA-PUB-08, CA-PUB-09.
- `setFormAccessMode(…, { accessMode: "public" })`: si `form.status === "published"` y la versión `publishedVersion` no tiene `consent` → `ValidationError("Para hacer público el formulario, publica de nuevo con los términos y condiciones.")` (la acción devuelve `{ ok:false, error }`). Si está en `draft`, se permite (se exigirá al publicar). `registered` se permite siempre. Cubre RF-PUB-14, CA-PUB-10.
- `getPublishedFormBySlug`: tras leer la versión publicada, si `form.accessMode === "public"` y su `consent` es `null` → `{ state: "closed" }`. Si no, `view.consent = accessMode === "public" ? toPublicConsent(consent) : null` y `view.organizationName = form.organization.name`. Cubre RF-PUB-14, RF-PUB-15, CA-PUB-10, CA-PUB-11.
- `getFormVersion` y `getPublishingState`: rellenan `consent` con `parseStoredConsent`; `suggestedConsent` sale de `findLatestConsentVersion`.

`publishFormAction`: además de lo que ya hace, si `publishFormSchema` falla, devuelve `{ ok:false, error:"Revisa los términos y condiciones.", issues }` con los `path` de Zod unidos por `.` (por ejemplo `consent.termsUrl`).

`GET /api/public/forms/[slug]` añade `consent` (`{ termsUrl, privacyUrl }` o `null`) y `organizationName`; sigue sin `organizationId`.

### Interfaz del panel

`ConsentFields` (`data-testid="consent-fields"`) se muestra solo con el selector en "Público con enlace":

- `<Input>` "Enlace a los términos y condiciones" (`terms-url`) y "Enlace a la política de privacidad" (`privacy-url`), con `suggestedConsent` como valor inicial.
- Casilla `publisher-declaration`: "Declaro que son los términos y la política de privacidad de mi organización, que soy responsable del tratamiento de los datos que se recojan con este formulario y que acepto el contrato de encargo de tratamiento con FormIA."
- Los errores del servidor (`issues` con `consent.*`) se muestran bajo cada campo (`data-testid="consent-error-<campo>"`).
- El botón Publicar queda deshabilitado en `public` mientras falte alguno de los tres datos (comprobación de cortesía; la autoridad es el servidor).
- Selección `registered → public` en un formulario ya publicado: si `state.consent` es `null` solo cambia la selección local y se muestra "Para hacerlo público, publica de nuevo con los términos y condiciones" (no se llama a `setAccessModeAction`); si no es `null`, se llama como hasta ahora. Pasar a `registered` siempre llama a la acción.
- `publishFormAction(formId, { accessMode, consent })` recibe los tres datos en `public`.

### Lado de quien rellena (cambios sobre #33)

Se detalla aquí para que el desarrollador no tome decisiones de diseño; los requisitos están en `field-collector`.

- `page.tsx` de `/f/[slug]` pasa `form.consent` y `form.organizationName` a `FillForm`.
- `ConsentCheckbox({ consent, organizationName, checked, onChange, error })` (`consent-checkbox.tsx`), solo cuando `consent !== null`:
  - Casilla `data-testid="consent-checkbox"`, con texto "He leído y acepto los términos y condiciones y la política de privacidad", donde "términos y condiciones" y "política de privacidad" son enlaces `data-testid="terms-link"` y `data-testid="privacy-link"` (`target="_blank"`, `rel="noopener noreferrer"`).
  - Aviso `data-testid="processor-notice"`: "Este formulario lo ofrece {organizationName}, responsable del tratamiento de tus datos. FormIA actúa como encargado del tratamiento."
  - Error `data-testid="consent-error"`: "Debes aceptar los términos y condiciones para enviar."
- `FillForm`: estado `acceptedTerms` (por defecto `false`; no forma parte de `answers`). Guardar con `consent !== null` y `!acceptedTerms` → muestra `consent-error`, enfoca la casilla y no llama a la red. `hasAnyAnswer` **no** cuenta la casilla (Descartar sin respuestas no pide confirmación solo por haberla marcado).
- `submit(ctx, clientId, answers, files)` añade `acceptedTerms` en el cuerpo (`ctx.acceptedTerms: boolean`). `fillSubmissionBodySchema` gana `acceptedTerms: z.boolean().optional()`.
- `submitFill`, tras el paso 2 (`getFormVersion`) y antes de llamar a `createSubmission`:
  1. Si `form.accessMode === "public"`: la versión pedida (`version.consent`) tiene que existir; si no (versión anterior sin términos) → `ValidationError("Esta versión del formulario ya no está disponible. Vuelve a abrirlo.")` (400).
  2. Si además `body.acceptedTerms !== true` → `SubmissionValidationError([{ fieldId: "_consent", message: "Debes aceptar los términos y condiciones para enviar." }])` (400 con `fieldErrors`).
  3. Se pasa a `createSubmission` `consent: { termsUrl, privacyUrl, formVersionNumber: version.version }` (los de **la versión pedida**, nunca los del cuerpo).
  4. En modo `registered` no se exige ni se guarda nada (`consent` indefinido).
- La limitación de tasa y el honeypot de #33 se aplican antes, sin cambios. El honeypot lleno sigue devolviendo "éxito" sin guardar.
- Registro (logs): nada nuevo; no se registran enlaces ni IP.

### Casilla del administrador y contrato de encargo

El texto de la declaración está en el panel y la declaración queda en `FormVersion.consent` (quién, cuándo). El contrato de encargo y la lista de subencargados son documentación de `privacy-gdpr` (`processor-role.md`); esta pieza no crea ninguna página legal nueva (pregunta 3).

### Errores

| Situación | Error | Server action | HTTP |
| --- | --- | --- | --- |
| Publicar `public` sin términos, enlace inválido o sin declaración | `PublishValidationError` (`issues` con `consent.*`) | `{ ok:false, error, issues }` | — |
| `registered → public` sin términos en la versión | `ValidationError` | `{ ok:false, error }` | — |
| Formulario `public` sin términos en la versión publicada | `{ state: "closed" }` | — | 410 |
| Guardar en `public` sin `acceptedTerms: true` | `SubmissionValidationError` (`fieldId "_consent"`) | — | 400 |
| Guardar en `public` con una versión sin términos | `ValidationError` | — | 400 |

### Seguridad y privacidad

- Los enlaces los escribe un administrador y se muestran a personas anónimas: solo `https`, sin credenciales, con `rel="noopener noreferrer"`; nunca se insertan como HTML. `javascript:` y `data:` se rechazan por el esquema.
- La prueba de aceptación se toma **de la versión guardada en servidor**, nunca de lo que envía el cliente; el cliente solo envía un booleano.
- El `declaredByUserId` no sale en ninguna lectura pública.
- `consent` contiene enlaces y fechas, no datos personales; las respuestas siguen sin registrarse en logs.
- Relación con el housekeeper (#24) y `privacy-gdpr`: `Submission.consent` se borra junto con la respuesta (caducidad, borrado de respuesta o de organización) y entra en la exportación JSON completa (RF-GDPR-01). No se conserva prueba de aceptación sin su respuesta (pregunta 4).

### Tests

Nombre de cada test: incluye el identificador del criterio.

| Criterio | Tipo | Fichero |
| --- | --- | --- |
| CA-PUB-08 | Vitest (unitario) | `src/lib/form-publishing/consent.schema.test.ts` — `HttpsUrlSchema` rechaza `http://`, `javascript:alert(1)`, `data:`, `https://user:pass@x.com`, vacío y más de 2048 caracteres; acepta `https://example.com/t?x=1`. `ConsentInputSchema` rechaza `publisherDeclaration: false`. `publishFormSchema`: `public` sin `consent` falla con path `consent`; `registered` sin `consent` pasa. |
| CA-PUB-08 | Vitest (integración) | `form-publishing.service.test.ts` — `describe("CA-PUB-08")`: `public` sin consent / con enlace `http` / sin declaración → `PublishValidationError`, 0 `FormVersion` nuevas; `registered` sin consent → publica y `FormVersion.consent` es `null`; `public` válido → `consent` guardado con `declaredByUserId` y `declaredAt`. |
| CA-PUB-09 | Vitest (integración) | idem — `describe("CA-PUB-09")`: v1 con enlaces A, v2 con enlaces B → `getFormVersion(v1.id).consent.termsUrl` es A y el de v2 es B; `getPublishingState.suggestedConsent` devuelve B. |
| CA-PUB-10 | Vitest (integración) | idem — `describe("CA-PUB-10")`: publicado `registered` → `setFormAccessMode("public")` lanza `ValidationError`; borrador → se permite; formulario `public` con `FormVersion.consent = null` (insertado directamente) → `getPublishedFormBySlug` devuelve `{ state: "closed" }`. |
| CA-PUB-11 | Vitest (integración) | idem — `describe("CA-PUB-11")`: `getPublishedFormBySlug` en `public` devuelve `consent` con los dos enlaces y `organizationName`, sin `declaredByUserId`; en `registered`, `consent` es `null`. |
| CA-PUB-08, CA-PUB-11 | Playwright | `e2e/form-publishing-consent.spec.ts` — el panel: con "Público con enlace" aparecen `consent-fields`; publicar con la declaración sin marcar muestra error; con datos válidos aparece el enlace; `GET /api/public/forms/<slug>` sin cookies trae `consent` y `organizationName` y no contiene `declaredBy`. |
| CA-PUB-10 | Playwright | idem — formulario publicado en `registered`: elegir "Público con enlace" muestra el aviso y **no** cambia el modo en el servidor hasta publicar con términos. |
| CA-COL-11 | Playwright | `e2e/field-collector-consent.spec.ts` — formulario `public` con términos (`publishViaService`): anónimo sin cookies abre `/f/<slug>`, rellena un campo de texto, pulsa Guardar sin marcar `consent-checkbox` → aparece `consent-error` y no hay `Submission` (consulta por servicio); marca la casilla y guarda → `save-success`/`/thanks` y existe 1 `Submission` con `consent` no nulo. En un formulario `registered` con sesión no existe `consent-checkbox`. |
| CA-GDPR-03 | Playwright | idem — en `/f/<slug>` público, `processor-notice` contiene el nombre de la organización y "FormIA actúa como encargado del tratamiento"; `terms-link` y `privacy-link` tienen el `href` configurado, `target="_blank"` y `rel` con `noopener`. |
| CA-COL-12 | Vitest (integración) | `src/server/field-collector/fill.service.test.ts` — `describe("CA-COL-12")`: `submitFill` en `public` sin `acceptedTerms` o con `false` → `SubmissionValidationError` con `fieldId "_consent"` y 0 filas; con una versión sin términos → `ValidationError`; con `true` → fila con `consent` cuyos enlaces son los de la versión del servidor aunque el cuerpo traiga otros campos; en `registered` no se exige y `consent` es `null`. |
| CA-COL-12 | Playwright | idem (`e2e/field-collector-consent.spec.ts`) — `POST /api/public/forms/<slug>/submissions` sin cookies y sin `acceptedTerms` responde 400 y no crea fila; con `acceptedTerms: true` responde 201. |

Los tests de #26 que publican en `public` pasan a usar `TEST_CONSENT_INPUT` (el desarrollador los actualiza; no cambian de intención).

## Tareas de desarrollo

Ver el plan de acción del issue #26 (orden de implementación) y, para los términos y condiciones, el del issue #38.

## Historial de cambios

- 2026-11-27 — Issue #38: sección "Términos y condiciones en formularios públicos" (`FormVersion.consent`, `Submission.consent`, validación, panel, lado de relleno, errores, tests).
- 2026-11-26 — Revisión del arquitecto (#26): `canPublish` también bloquea `phase === "error"`; texto del 403 de `/f/[slug]`; slug asignado dentro de la transacción; `runtime = "nodejs"` en el QR y dependencia `qrcode` aprobada.
- 2026-11-26 — Diseño inicial (#26): `FormVersion`, columnas `slug`, `accessMode` y `publishedVersion` en `Form`, servicio de publicación y contrato de lectura, endpoint público y QR, `PublishPanel`, página `/f/[slug]` mínima y cambio del listado de `form-editor`.
