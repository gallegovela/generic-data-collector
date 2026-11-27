# Publicación y versiones — Diseño técnico

- **Requisitos:** [README.md](README.md)
- **Plan de pruebas:** [test-plan.md](test-plan.md)
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #26 (diseño), padre #23

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

`/api/**` y `/f/**` quedan fuera del `matcher` del middleware (solo guarda `/admin` y `/forms`), así que la autenticación de estas rutas es la que hace cada handler.

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

## Tareas de desarrollo

Ver el plan de acción del issue #26 (orden de implementación).

## Historial de cambios

- 2026-11-27 — Solo texto (#39): el middleware guarda `/admin` y `/forms` (antes `/collect`, retirada). `listPublishedForms` se añade a este repositorio (ver tenancy-auth/design.md).

- 2026-11-26 — Revisión del arquitecto (#26): `canPublish` también bloquea `phase === "error"`; texto del 403 de `/f/[slug]`; slug asignado dentro de la transacción; `runtime = "nodejs"` en el QR y dependencia `qrcode` aprobada.
- 2026-11-26 — Diseño inicial (#26): `FormVersion`, columnas `slug`, `accessMode` y `publishedVersion` en `Form`, servicio de publicación y contrato de lectura, endpoint público y QR, `PublishPanel`, página `/f/[slug]` mínima y cambio del listado de `form-editor`.
