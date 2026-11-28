# Ajustes de administración y planes de uso — Diseño técnico

- **Requisitos:** [README.md](README.md)
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #40 (diseño), padre #23

## Resumen

1. **Ajustes**: `/admin/settings` con layout propio (barra de subsecciones definida en una lista) dentro de `/admin`, cuyo layout ya exige `admin` (`requireAdminPage`). Cada página y cada server action vuelven a exigirlo (defensa en profundidad).
2. **Modelo**: `Plan` global y `Organization.planId` obligatorio. `UsageCounter`: una fila por `(organizationId, formId, kind, windowStart)`.
3. **Contador atómico en PostgreSQL** con un único `INSERT … ON CONFLICT DO UPDATE … WHERE count < límite RETURNING count`. Si la cláusula `WHERE` no se cumple no se devuelve fila → «límite alcanzado». Así no se supera el límite aunque haya peticiones simultáneas y no hace falta transacción. Descartados: contadores en memoria (se pierden al reiniciar y no valen con varias instancias), Redis (fuera del piloto).
4. **Ventana**: hora natural UTC (`windowStart` = fecha truncada a la hora).
5. **Aplicación**: `createSubmission` consume cupo justo antes de insertar (tras idempotencia y validación, para no gastar cupo en respuestas rechazadas ni repetidas) y lo devuelve (`refundUsage`) si el insert falla o pierde la carrera de idempotencia. `uploadFile` compara con `maxFileBytes` antes de detectar el tipo.
6. Impresiones: solo servicio (`consumeUsage(..., "impression")`). No se toca `src/app/f/[slug]/`.

## Modelo de datos

```prisma
enum UsageKind {
  impression
  submission
}

model Plan {
  id                    String   @id @default(cuid())
  name                  String   @unique
  maxImpressionsPerHour Int?     // null = sin límite
  maxSubmissionsPerHour Int?
  maxFileBytes          Int?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  organizations Organization[]

  @@map("plans")
}

model UsageCounter {
  id             String    @id @default(cuid())
  organizationId String
  formId         String    // identificador lógico, sin FK (como Submission.formId)
  kind           UsageKind
  windowStart    DateTime  // hora natural UTC
  count          Int       @default(0)

  organization Organization @relation(fields: [organizationId], references: [id])

  @@unique([organizationId, formId, kind, windowStart])
  @@index([windowStart])
  @@map("usage_counters")
}

model Organization {
  // ...campos existentes...
  planId        String
  plan          Plan           @relation(fields: [planId], references: [id])
  usageCounters UsageCounter[]
}
```

### Migración `<timestamp>_add_admin_settings_plans`

Se genera con `npx prisma migrate dev --create-only --name add_admin_settings_plans` y se **edita a mano** el SQL para que sea segura con filas existentes, en este orden:

1. `CREATE TYPE "UsageKind"`, `CREATE TABLE "plans"` (+ índice único de `name`), `CREATE TABLE "usage_counters"` (+ índices, FK a `organizations`).
2. `INSERT INTO "plans" (id, name, "maxImpressionsPerHour", "maxSubmissionsPerHour", "maxFileBytes", "createdAt", "updatedAt") VALUES ('plan-generic', 'Genérico', 10000, 1000, 10485760, now(), now());`
3. `ALTER TABLE "organizations" ADD COLUMN "planId" TEXT;` → `UPDATE "organizations" SET "planId" = 'plan-generic';` → `ALTER COLUMN "planId" SET NOT NULL;` → FK `organizations_planId_fkey` (`ON DELETE RESTRICT`).

Los 10 485 760 bytes igualan el tope técnico `STORAGE_MAX_UPLOAD_BYTES` por defecto: el plan genérico no restringe más que el sistema.

### Seed (`prisma/seed.ts`)

Antes de crear la organización: `prisma.plan.upsert({ where: { id: "plan-generic" }, update: {}, create: { id: "plan-generic", name: "Genérico", ... } })`, y la organización `demo-org` se crea con `planId: "plan-generic"` (en `create`; el `update` no lo toca). Cualquier otro lugar que cree organizaciones (`createOrganization` en `src/server/auth/organization.repository.ts`, tests y fixtures) debe aceptar/rellenar `planId`: `createOrganization(data: { name: string; planId?: string })` usa `planId ?? DEFAULT_PLAN_ID` (`"plan-generic"`, constante en `src/lib/admin-settings/plan.schema.ts`). Los tests que crean organizaciones garantizan antes que el plan existe (`ensureGenericPlan()` en un helper de test, `src/server/admin-settings/test-helpers.ts`, con `upsert`).

## Estructura de ficheros

| Capa | Ruta | Responsabilidad |
| --- | --- | --- |
| Modelo | `prisma/schema.prisma`, `prisma/migrations/…`, `prisma/seed.ts` | Ver arriba. |
| Esquema | `src/lib/admin-settings/plan.schema.ts` | Zod de plan y asignación; `DEFAULT_PLAN_ID`. |
| Lógica pura | `src/lib/admin-settings/usage-window.ts` | `currentWindowStart(now: Date): Date`. |
| Lógica pura | `src/lib/admin-settings/settings-sections.ts` | Lista de subsecciones (`SETTINGS_SECTIONS`). |
| Errores | `src/lib/errors.ts` (modificar) | `PlanLimitError`. |
| Repositorio | `src/server/admin-settings/plan.repository.ts` | CRUD de `Plan`, plan de una organización, asignación. |
| Repositorio | `src/server/admin-settings/usage.repository.ts` | SQL del contador. |
| Servicio | `src/server/admin-settings/plan.service.ts` | Reglas de planes y `assertCanManagePlans`. |
| Servicio | `src/server/admin-settings/usage-limits.service.ts` | Límites efectivos y consumo. |
| Entrada | `src/server/admin-settings/plan.actions.ts` | Server actions. |
| Interfaz | `src/app/admin/settings/layout.tsx`, `page.tsx`, `plans/page.tsx` | Layout con subnav, redirección, página de planes. |
| Interfaz | `src/components/admin-settings/settings-nav.tsx`, `plans-manager.tsx` | Subnav (cliente, `usePathname`) y gestor de planes. |
| Interfaz | `src/app/admin/layout.tsx` (modificar) | Enlace «Ajustes» (`/admin/settings`). |
| Integración | `src/server/submissions/submission.service.ts`, `src/server/storage/storage.service.ts` (modificar) | Aplicación de los límites. |
| Test | `src/server/admin-settings/test-helpers.ts` | `ensureGenericPlan()`. |

## Contratos

### Errores

```ts
// src/lib/errors.ts
export type PlanLimitKind = "impressions" | "submissions";
export class PlanLimitError extends Error {
  constructor(public readonly limit: PlanLimitKind, message = "Se ha alcanzado el límite de tu plan. Inténtalo más tarde.") // name = "PlanLimitError"
}
```
HTTP que usará el consumidor: 429. Para tamaño de archivo se reutiliza `PayloadTooLargeError` (413, ya traducido por `/api/files`) con mensaje propio.

### Esquemas (`plan.schema.ts`)

```ts
export const DEFAULT_PLAN_ID = "plan-generic";
const limit = z.number().int().positive().max(2_147_483_647).nullable();
export const planInputSchema = z.object({
  name: z.string().trim().min(1, "Indica un nombre.").max(80),
  maxImpressionsPerHour: limit,
  maxSubmissionsPerHour: limit,
  maxFileBytes: limit,
});
export type PlanInput = z.infer<typeof planInputSchema>;
export const planIdSchema = z.string().min(1).max(100);
```
Los formularios envían texto: el campo vacío = `null` («sin límite»); la action convierte `""` → `null` y el resto con `Number` antes de `safeParse`. En la interfaz el tamaño se edita en **MB** (decimal permitido, convertido a bytes con `Math.round(mb * 1048576)`) y se guarda en bytes.

### Repositorios

```ts
// plan.repository.ts
export type PlanRecord = { id: string; name: string; maxImpressionsPerHour: number | null; maxSubmissionsPerHour: number | null; maxFileBytes: number | null; createdAt: Date; updatedAt: Date };
export type PlanWithUsage = PlanRecord & { organizationCount: number };
export function listPlans(): Promise<PlanWithUsage[]>;                 // orden: name asc
export function findPlanById(id: string): Promise<PlanRecord | null>;
export function findPlanByOrganization(organizationId: string): Promise<PlanRecord | null>; // organizations.findUnique({ where:{id}, select:{ plan:true } })
export function createPlan(data: PlanInput): Promise<PlanRecord>;     // P2002 → lanza ConflictError("Ya existe un plan con ese nombre.")
export function updatePlan(id: string, data: PlanInput): Promise<PlanRecord | null>; // P2002 → ConflictError; P2025 → null
export function countPlans(): Promise<number>;
export function countOrganizationsOnPlan(planId: string): Promise<number>;
export function deletePlan(id: string): Promise<boolean>;             // P2003 (FK) → ConflictError; P2025 → false
export function setOrganizationPlan(organizationId: string, planId: string): Promise<void>; // update where id = organizationId
```
`Plan` es global: es la única excepción a «toda consulta filtra por `organizationId`». Todo lo demás del módulo filtra.

```ts
// usage.repository.ts
/** SQL atómico. Devuelve el contador tras incrementar, o null si el límite ya estaba alcanzado. */
export function incrementUsage(input: { organizationId: string; formId: string; kind: UsageKind; windowStart: Date; limit: number | null }): Promise<number | null>;
export function decrementUsage(input: { organizationId: string; formId: string; kind: UsageKind; windowStart: Date }): Promise<void>;
export function getUsageCount(input: { organizationId: string; formId: string; kind: UsageKind; windowStart: Date }): Promise<number>;
```

`incrementUsage` usa `prisma.$queryRaw` con parámetros (nunca interpolación de cadenas). Tablas y columnas se citan tal como las crea Prisma (`"usage_counters"`, `"organizationId"`…):

```sql
INSERT INTO "usage_counters" ("id","organizationId","formId","kind","windowStart","count")
VALUES (${randomUUID()}, ${organizationId}, ${formId}, ${kind}::"UsageKind", ${windowStart}, 1)
ON CONFLICT ("organizationId","formId","kind","windowStart")
DO UPDATE SET "count" = "usage_counters"."count" + 1
WHERE "usage_counters"."count" < ${limit}
RETURNING "count"
```
Con `limit === null` se usa la misma consulta sin la línea `WHERE`. Si no hay filas devueltas → `null`. `decrementUsage`: `UPDATE "usage_counters" SET "count" = GREATEST("count" - 1, 0) WHERE …` (mismos cuatro campos).

### Servicios

```ts
// usage-limits.service.ts
export type EffectiveLimits = { planId: string; planName: string; maxImpressionsPerHour: number | null; maxSubmissionsPerHour: number | null; maxFileBytes: number | null };
/** Lanza NotFoundError si la organización no existe. */
export function getEffectiveLimits(organizationId: string): Promise<EffectiveLimits>;

export type ConsumeResult = { allowed: true; used: number; limit: number | null } | { allowed: false; used: number; limit: number };
/** `now` solo para tests. allowed:false → `used` = límite. No lanza por límite alcanzado. */
export function consumeUsage(organizationId: string, formId: string, kind: "impression" | "submission", now?: Date): Promise<ConsumeResult>;
/** Para el consumidor que prefiere excepciones. Lanza PlanLimitError("impressions" | "submissions") si allowed=false. */
export function assertUsage(organizationId: string, formId: string, kind: "impression" | "submission", now?: Date): Promise<void>;
export function refundUsage(organizationId: string, formId: string, kind: "impression" | "submission", now?: Date): Promise<void>;
export function getUsage(organizationId: string, formId: string, kind: "impression" | "submission", now?: Date): Promise<{ used: number; limit: number | null }>;
```
`consumeUsage` lee `getEffectiveLimits`, elige el límite según `kind` (`impression` → `maxImpressionsPerHour`, `submission` → `maxSubmissionsPerHour`), calcula `currentWindowStart(now ?? new Date())` y llama a `incrementUsage`. `used` si `null`: `limit`. `assertUsage` y `refundUsage` son envoltorios finos. `refundUsage` debe usar la **misma ventana** que el consumo: `createSubmission` calcula `now` una vez y se lo pasa a ambos.

```ts
// usage-window.ts
export function currentWindowStart(now: Date): Date; // new Date(Date.UTC(y, m, d, h))

// plan.service.ts
export function assertCanManagePlans(user: { role: Role }): void; // hoy: role !== "admin" → ForbiddenError. Único punto a sustituir por el rol de plataforma.
export function listAllPlans(): Promise<PlanWithUsage[]>;
export function createNewPlan(user, input: PlanInput): Promise<PlanRecord>;
export function updateExistingPlan(user, id: string, input: PlanInput): Promise<PlanRecord>; // NotFoundError si no existe
export function removePlan(user, id: string): Promise<void>;
  // NotFoundError si no existe; ConflictError("No se puede borrar un plan asignado a organizaciones.") si countOrganizationsOnPlan > 0;
  // ConflictError("No se puede borrar el último plan.") si countPlans() <= 1.
export function assignPlanToOrganization(user: { role: Role; organizationId: string }, planId: string): Promise<void>;
  // assertCanManagePlans; NotFoundError si el plan no existe; setOrganizationPlan(user.organizationId, planId). No recibe organizationId externo.
```
(`user` es `CurrentUser`.) El último plan nunca está sin asignar si hay organizaciones, así que la regla «último plan» solo importa sin organizaciones, pero se comprueba igualmente; ambas comprobaciones se hacen antes de `deletePlan`, que además traduce el `P2003` de la FK por si hay una carrera.

### Server actions (`plan.actions.ts`, `"use server"`)

Mismo patrón que `user.actions.ts`: `(prevState, formData) => Promise<{ error?: string; ok?: true }>`. Cada una empieza con `const user = await requireSession({ role: "admin" })` (lanza `UnauthorizedError` / `ForbiddenError`), valida con Zod, llama al servicio, captura `ConflictError` / `NotFoundError` → `{ error: error.message }` y llama a `revalidatePath("/admin/settings/plans")` si va bien.

- `createPlanAction`: campos `name`, `maxImpressionsPerHour`, `maxSubmissionsPerHour`, `maxFileMb`.
- `updatePlanAction`: además `planId`.
- `deletePlanAction`: `planId`.
- `assignPlanAction`: `planId` (asigna a `user.organizationId`).

### Interfaz

- `src/app/admin/settings/layout.tsx` (servidor): `await requireAdminPage()`; título «Ajustes» + `<SettingsNav sections={SETTINGS_SECTIONS} />` + `children`.
- `settings-sections.ts`: `export const SETTINGS_SECTIONS = [{ href: "/admin/settings/plans", label: "Planes" }] as const;`
- `page.tsx`: `redirect(SETTINGS_SECTIONS[0].href)`.
- `plans/page.tsx`: `requireSession({ role: "admin" })`, `listAllPlans()`, `getEffectiveLimits(user.organizationId)` (para marcar el plan actual) y `<PlansManager plans currentPlanId />`.
- `PlansManager` (cliente, `useActionState`, como `user-management.tsx`): tabla con nombre, límites («Sin límite» si nulo; tamaño en MB), nº de organizaciones y botones «Usar este plan» (deshabilitado en el actual), «Editar» y «Borrar» (con `confirm`; deshabilitado si `organizationCount > 0`, con título explicativo); formulario de alta/edición con tres campos numéricos opcionales («Vacío = sin límite»). El texto de la interfaz va en un objeto `TEXTS` al principio del fichero (i18n). Debe incluir una nota visible: «Los planes son comunes a todas las organizaciones.»
- Selectores/atributos para los tests: `data-testid="plans-table"`, `data-testid="plan-row-<name>"`.

## Aplicación en los servicios existentes

### `createSubmission` (RF-SET-11)

Orden de los pasos actuales y cambio (solo el paso 8):

1–7 igual (el paso 4 devuelve el existente sin consumir cupo).
8. `const now = new Date(); await assertUsage(organizationId, form.id, "submission", now);` (lanza `PlanLimitError("submissions")` → no se crea nada).
9. `try { insertSubmission... } catch (error) { if (!isUniqueViolation(error)) { await refundUsage(..., now).catch(() => undefined); throw error; } …carrera: await refundUsage(..., now).catch(() => undefined) y se devuelve el existente como hoy… }`. Si el insert tiene éxito, no se devuelve nada.

Si ya existía por carrera, el cupo consumido se devuelve porque no es una recepción nueva.

### `uploadFile` (RF-SET-12)

Tras el chequeo `> STORAGE_MAX_UPLOAD_BYTES` y antes de `detectFileType`:

```ts
const { maxFileBytes } = await getEffectiveLimits(organizationId);
if (maxFileBytes !== null && bytes.byteLength > maxFileBytes) {
  throw new PayloadTooLargeError(`El archivo supera el tamaño máximo de tu plan (${formatMb(maxFileBytes)}).`);
}
```
`formatMb` (en `src/lib/admin-settings/plan.schema.ts`, exportada): `bytes / 1048576` con hasta 1 decimal y coma, «MB» (p. ej. `"1 MB"`, `"0,5 MB"`). Un archivo exactamente igual al límite se acepta. El límite efectivo es `min(plan, STORAGE_MAX_UPLOAD_BYTES)` porque el tope global se comprueba antes. La ruta `/api/files` ya traduce `PayloadTooLargeError` a 413; el mensaje llega al cliente en `error.message`. No hay cambios en la ruta.

## Seguridad y privacidad

- Roles: layout (`requireAdminPage`), página (`requireSession`) y acciones (`requireSession({ role: "admin" })`).
- La asignación de plan usa `user.organizationId` de la sesión, nunca un campo del formulario.
- Contadores sin IP ni datos personales (RNF-SET-03). Los logs no incluyen contenido de respuestas.
- SQL con parámetros enlazados.
- Los planes globales editables por cualquier `admin` están documentados como limitación (README).

## Tests

| Criterio | Tipo | Fichero |
| --- | --- | --- |
| CA-SET-01 | Vitest | `src/server/admin-settings/plan.actions.test.ts` (sin sesión → `UnauthorizedError`; `collector` → `ForbiddenError`; admin → ok) |
| CA-SET-01 | Playwright | `e2e/admin-settings-access.spec.ts` (collector → `/collect`; anónimo → `/login`; admin ve «Planes») |
| CA-SET-02, 03 | Vitest (Prisma real) | `src/server/submissions/submission.service.test.ts` (describe «límite de plan») |
| CA-SET-04 | Vitest | `src/server/storage/storage.service.test.ts` (describe «límite de plan») |
| CA-SET-05, 06, 08, 11 | Vitest (Prisma real) | `src/server/admin-settings/usage-limits.service.test.ts` y `usage.repository.test.ts` |
| CA-SET-07 | Vitest (Prisma real) | `src/server/admin-settings/migration.test.ts` (existe el plan `plan-generic`, ninguna organización con `planId` nulo; el seed es idempotente) |
| CA-SET-09, 10 | Vitest (Prisma real) | `src/server/admin-settings/plan.service.test.ts` |
| Lógica pura | Vitest | `src/lib/admin-settings/usage-window.test.ts`, `plan.schema.test.ts` |
| Flujo UI | Playwright | `e2e/admin-settings-plans.spec.ts` (crear, editar y borrar un plan; asignarlo) |

**Nombres obligatorios** (el plan filtra con `-t`; con 0 coincidencias Vitest sale con 0):

| Filtro `-t` | El nombre del test debe contener | Mínimo |
| --- | --- | --- |
| `acceso de ajustes` | "acceso de ajustes" | 3 |
| `límite de recepciones` | "límite de recepciones" | 3 |
| `límite de tamaño` | "límite de tamaño" | 3 |
| `sin límite` | "sin límite" | 2 |
| `aislamiento de contadores` | "aislamiento de contadores" | 2 |
| `límite de impresiones` | "límite de impresiones" | 2 |
| `concurrencia` | "concurrencia" | 1 |
| `borrado de planes` | "borrado de planes" | 3 |
| `asignación de plan` | "asignación de plan" | 2 |
| `plan genérico` | "plan genérico" | 2 |

Los tests de contadores usan el parámetro `now` para fijar la hora (p. ej. comprobar que en la hora siguiente el cupo vuelve a estar libre). El de concurrencia lanza `Promise.all` de 20 `consumeUsage` con límite 5 y espera exactamente 5 `allowed: true`. Los de `createSubmission` y `uploadFile` crean sus plan y organización con Prisma real y limpian en `afterAll`; usan `InMemoryStorageAdapter`.

## Tareas de desarrollo

| Orden | Issue | Tarea | Depende de |
| --- | --- | --- | --- |
| 1 | #40 | Todo lo anterior (una sola PR) | — |
| 2 | `field-collector` | Enganchar `assertUsage(..., "impression")` en `/f/<slug>` y traducir `PlanLimitError` a 429 | #33, #40 |

## Historial de cambios

- 2026-11-27 — Diseño inicial: modelo `Plan` y `UsageCounter`, contador atómico, server actions, aplicación en `createSubmission` y `uploadFile` (#40).
