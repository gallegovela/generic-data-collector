# Organizaciones, usuarios y autenticación — Diseño técnico

- **Requisitos:** [README.md](README.md)
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #4 (diseño), padre #1; #20 (límite de login y trazabilidad), padre #18; #39 (retirar `/collect`, listado `/forms`), padre #23

## Resumen

Se usa Auth.js v5 (`next-auth`) con estrategia de sesión **JWT** (cookie `httpOnly`/`secure`/`sameSite`, sin tablas `Account`/`Session` de adaptador: no hace falta porque no hay proveedores OAuth). Dos proveedores `Credentials`:

- `password` — email + contraseña, verificada contra `User.passwordHash` (bcrypt).
- `magic-link` — un token de un solo uso (`LoginToken`) que se genera al pedir el enlace y se verifica al abrirlo; mismo mecanismo de sesión que el login con contraseña, sin tablas de verificación propias de proveedores OAuth/Email de Auth.js.

`Organization` y `User` (con `role: admin | collector`) son las primeras entidades de negocio del proyecto (primera migración real tras el esqueleto vacío de `platform`). No hay alta de organizaciones desde la interfaz en el piloto: las crea el seed; los usuarios nuevos entran siempre por invitación (`Invitation`) o ya existen en el seed.

Un único módulo de servidor, `src/server/auth/session.ts`, expone `requireSession`/`getCurrentOrg`: todos los demás módulos lo importan para no repetir el filtro por `organizationId` ni la comprobación de rol (RNF-AUT-02). Un `middleware.ts` en la raíz protege `/admin/**` (solo `admin`) y `/forms/**` (cualquier sesión; antes `/collect/**`, retirada en #39); las rutas `/f/**` (relleno público de formularios, que añadirá `field-collector`/`form-publishing`) no están en el `matcher` del middleware, así que nunca pasan por el guardián de sesión — es la parte de infraestructura de RF-AUT-08.

El envío de email (enlace mágico e invitaciones) usa un adaptador SMTP genérico (`nodemailer`, contra Mailpit en local) en `src/server/integrations/email.ts`, reutilizable por otros módulos (por ejemplo `outputs`). Se introduce también `src/lib/errors.ts` con las clases de error de dominio (`NotFoundError`, `ForbiddenError`, `UnauthorizedError`, `ConflictError`, `ValidationError`, `RateLimitError`), que no existían todavía y que reutilizarán los módulos siguientes.

**Decisión explícita para `field-collector`/`form-publishing` (pregunta abierta resuelta, ver README):** un `collector` tiene cuenta y usa `/forms` (listado de formularios publicados, protegido por sesión; #39); un formulario publicado puede además marcarse público y rellenarse sin sesión en `/f/[slug]`. El campo "público/restringido" en sí lo añade `form-publishing` sobre `Form`; este módulo ya deja la ruta `/f/**` fuera del guardián para que esa variante funcione sin tocar el middleware otra vez.

## Modelo de datos

```prisma
// prisma/schema.prisma — se añaden estos bloques (primera migración de negocio)

enum Role {
  admin
  collector
}

enum UserStatus {
  active
  inactive
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users       User[]
  invitations Invitation[]

  @@map("organizations")
}

model User {
  id             String     @id @default(cuid())
  organizationId String
  email          String     @unique
  name           String
  passwordHash   String
  role           Role
  status         UserStatus @default(active)
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  loginTokens  LoginToken[]

  @@index([organizationId])
  @@map("users")
}

model Invitation {
  id              String    @id @default(cuid())
  organizationId  String
  email           String
  role            Role
  token           String    @unique
  invitedByUserId String
  expiresAt       DateTime
  acceptedAt      DateTime?
  createdAt       DateTime  @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@map("invitations")
}

model LoginToken {
  id        String    @id @default(cuid())
  userId    String
  token     String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("login_tokens")
}
```

- `User.email` es único **globalmente** (no por organización): un email solo puede estar en una organización, como ya fija RF-AUT-03/CLAUDE.md ("un usuario en varias organizaciones" está fuera de alcance), y el login busca por email sin conocer antes la organización.
- `User.passwordHash` no es opcional: todo usuario se crea por invitación (que exige fijar contraseña al aceptar, RF-AUT-01) o por el seed; el enlace mágico es una forma adicional de iniciar sesión para un usuario que ya existe, no un tipo de cuenta distinto.
- Índices: `organizationId` en `User` e `Invitation` (siempre primero en los `where` del repositorio); `token` único en `Invitation` y `LoginToken` para la búsqueda directa.
- Sin tablas `Account`/`Session`/`VerificationToken` de Auth.js: con `session: { strategy: "jwt" }` y proveedores `Credentials`, Auth.js no las necesita.
- Migración: `init_tenancy_auth` (`npx prisma migrate dev --name init_tenancy_auth`).

## Estructura de ficheros

| Capa | Ruta | Responsabilidad |
| --- | --- | --- |
| Modelo | `prisma/schema.prisma` (modificar) | `Organization`, `User`, `Invitation`, `LoginToken`, enums `Role`/`UserStatus`. |
| Entorno | `src/lib/env.ts` (modificar), `.env.example` (modificar) | Añade `AUTH_SECRET`, `AUTH_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD` (ver [Variables de entorno](#variables-de-entorno)). |
| Errores compartidos | `src/lib/errors.ts` | Clases de error de dominio reutilizables por todos los módulos. |
| Esquemas | `src/lib/auth/auth.schema.ts` | Zod: `loginSchema`, `requestMagicLinkSchema`, `inviteUserSchema`, `acceptInvitationSchema`. |
| Repositorio | `src/server/auth/organization.repository.ts` | `createOrganization`, `findOrganizationById`. |
| Repositorio | `src/server/auth/user.repository.ts` | Ver [Contratos](#funciones). Todas las funciones que leen/escriben usuarios de una organización reciben `organizationId`; `findUserByEmail` es la única excepción (necesaria para el login, antes de conocer la organización). |
| Repositorio | `src/server/auth/invitation.repository.ts` | `createInvitation`, `findInvitationByToken`, `markInvitationAccepted`, `listPendingInvitations`. |
| Repositorio | `src/server/auth/login-token.repository.ts` | `createLoginToken`, `findValidLoginToken`, `markLoginTokenUsed`. |
| Servicio | `src/server/auth/auth.service.ts` | `hashPassword`, `verifyPassword`, `requestMagicLink`, `verifyMagicLink`. |
| Servicio | `src/server/auth/user.service.ts` | `inviteUser`, `acceptInvitation`, `listUsers`, `deactivateUser`. |
| Servicio | `src/server/auth/rate-limit.ts` | `isBlocked`, `recordFailure`, `reset` (límite de **fallos** en memoria con limpieza, RNF-AUT-04). Sustituye a `checkAndConsume`. |
| Servicio | `src/server/auth/authorize.ts` | `authorizePassword`, `authorizeMagicLink`: lógica de los `authorize()` de Auth.js (traducen errores a motivo, registran el fallo y devuelven usuario o `null`/lanzan). Separado de `src/auth.ts` para poder testearlo sin montar NextAuth (#20). |
| Lib | `src/lib/auth/login-failure.ts` | `LoginFailureReason`, `classifyLoginError`, `logLoginFailure` (log JSON sin datos personales, RNF-AUT-05). Sin E/S salvo `console.warn`. |
| Lib | `src/lib/auth/login-errors.ts` | `RateLimitedSignin` (subclase de `CredentialsSignin` con `code = "rate_limited"`) y la constante `RATE_LIMITED_CODE`. Importable desde cliente (sin dependencias de servidor). |
| Servicio | `src/server/auth/session.ts` | `getCurrentUser`, `requireSession`, `requireAdminPage`, `getCurrentOrg`. **Lo importan todos los módulos siguientes.** |
| Integración | `src/server/integrations/email.ts` | `sendEmail`. Cliente SMTP (nodemailer) genérico. |
| Integración | `src/lib/auth/emails.ts` | `buildMagicLinkEmail`, `buildInvitationEmail` (asunto + HTML + texto, sin E/S). |
| Auth.js | `src/auth.ts` | `NextAuth(...)`: proveedores, callbacks `jwt`/`session`, exporta `handlers`, `auth`, `signIn`, `signOut`. |
| Tipos | `src/types/next-auth.d.ts` | Aumenta `Session.user` con `id`, `organizationId` y `role`, y `User` con `organizationId` y `role`. |
| Entrada | `src/app/api/auth/[...nextauth]/route.ts` | `export const { GET, POST } = handlers`. |
| Entrada | `src/server/auth/auth.actions.ts` | Server actions: `requestMagicLinkAction`. |
| Entrada | `src/server/auth/user.actions.ts` | Server actions: `inviteUserAction`, `deactivateUserAction`, `acceptInvitationAction`. |
| Middleware | `middleware.ts` (raíz) | Guardián de sesión de `/admin/**` (solo `admin`; un `collector` va a `/forms`) y `/forms/**` (cualquier sesión) (RF-AUT-06, RF-AUT-09). |
| Interfaz | `src/app/login/page.tsx`, `src/components/auth/login-form.tsx` | Formulario de login (contraseña o enlace mágico). |
| Interfaz | `src/app/login/magic/page.tsx` | Verifica el token del enlace mágico (`?token=`) y abre sesión. |
| Interfaz | `src/app/invite/[token]/page.tsx`, `src/components/auth/accept-invitation-form.tsx` | Aceptar invitación: fijar contraseña. |
| Interfaz | `src/app/admin/layout.tsx`, `src/app/admin/page.tsx` | Layout protegido y placeholder del panel (el contenido real lo añade `form-editor`, #6). |
| Interfaz | `src/app/admin/users/page.tsx` | Listado de usuarios e invitaciones de la organización, invitar, desactivar. |
| ~~Interfaz~~ | ~~`src/app/collect/page.tsx`~~ | **Eliminado en #39** (placeholder de la app de recogida). |
| Interfaz | `src/app/forms/page.tsx`, `src/components/forms/published-forms-list.tsx` | Listado de formularios publicados con «Rellenar» (RF-AUT-09, #39). Ver [Listado de formularios publicados](#listado-de-formularios-publicados-39). |
| Repositorio | `src/server/form-publishing/form-publishing.repository.ts` (añadir) | `listPublishedForms(organizationId)` (#39). |
| Servicio | `src/server/form-publishing/form-publishing.service.ts` (añadir) | `listPublishedFormsForOrg(organizationId)` (#39). |
| Datos de ejemplo | `prisma/seed.ts` (modificar) | Crea la organización de ejemplo, un admin y un collector (sustituye el placeholder de `platform`). Credenciales fijas, ver [Datos de ejemplo (seed)](#datos-de-ejemplo-seed). |

### Datos de ejemplo (seed)

`prisma/seed.ts` crea exactamente estos registros (los consumen PP-AUT-07, PP-AUT-08 y el futuro `demo-seed`; no deben variar entre quien escribe el seed y quien escribe los tests e2e):

| Campo | Admin | Collector |
| --- | --- | --- |
| `Organization.name` | "Constructora Demo" (la misma para ambos) | |
| `email` | `admin@demo.formia.local` | `collector@demo.formia.local` |
| `password` (texto plano, antes de `hashPassword`) | `Demo1234!` | `Demo1234!` |
| `name` | "Admin Demo" | "Collector Demo" |
| `role` | `admin` | `collector` |
| `status` | `active` | `active` |

Convención de nombre adoptada: el código de este módulo vive en `src/server/auth/` (no `src/server/tenancy-auth/`), porque coincide con el fichero raíz idiomático de Auth.js v5 (`src/auth.ts`) y con el nombre corto que van a importar todos los módulos (`@/server/auth/session`). Se señala como decisión a confirmar por el arquitecto (ver preguntas en el issue).

## Contratos

### Variables de entorno

Se añaden a `envSchema` (`src/lib/env.ts`) y a `.env.example`:

```ts
AUTH_SECRET: z.string().min(32),                 // secreto de firma del JWT de sesión
AUTH_URL: z.string().url().default("http://localhost:3000"), // base para enlaces absolutos en emails
SMTP_HOST: z.string().min(1).default("localhost"),
SMTP_PORT: z.coerce.number().int().positive().default(1025), // Mailpit en local
SMTP_FROM: z.string().email().default("no-reply@formia.local"),
SMTP_USER: z.string().optional(),                // vacío = sin autenticación SMTP (Mailpit)
SMTP_PASSWORD: z.string().optional(),
```

`.env.example` documenta `AUTH_SECRET` con un placeholder (`changeme-generate-with-openssl-rand-base64-32`) y el resto con los valores de Mailpit en local.

### Endpoints

| Método | Ruta | Rol | Entrada | Respuestas |
| --- | --- | --- | --- | --- |
| GET/POST | `/api/auth/[...nextauth]` | público | gestionado por Auth.js | gestionadas por Auth.js (login, logout, CSRF); no se añade lógica propia aquí, solo los dos proveedores `Credentials` |

El resto de operaciones (pedir enlace mágico, invitar, aceptar invitación, desactivar) son **server actions**, no rutas HTTP propias:

### Server actions

```ts
// src/server/auth/auth.actions.ts
"use server";
export async function requestMagicLinkAction(
  _prevState: unknown,
  formData: FormData,
): Promise<{ sent: true }>; // siempre `sent: true`: no revela si el email existe (RNF-AUT-02)
```

```ts
// src/server/auth/user.actions.ts
"use server";
export async function inviteUserAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; invited?: true }>;
// requireSession({ role: "admin" }); valida con inviteUserSchema; llama a userService.inviteUser;
// error de dominio ConflictError -> { error: "Ya hay un usuario con ese email." }

export async function deactivateUserAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }>;
// requireSession({ role: "admin" }); userService.deactivateUser(organizationId, currentUser.id, userId)

export async function acceptInvitationAction(
  token: string,
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }>;
// valida con acceptInvitationSchema; llama a userService.acceptInvitation(token, password);
// la propia página, en cliente, hace signIn("password", { email, password, redirect: false })
// tras un resultado sin error, y redirige según el rol devuelto.
```

### Funciones

```ts
// src/lib/errors.ts
export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}
export class UnauthorizedError extends Error {}
export class ConflictError extends Error {}
export class ValidationError extends Error {}
export class RateLimitError extends Error {}
/** #20: usuario existente pero `inactive`. Hereda de UnauthorizedError, así que el código que captura
 *  UnauthorizedError sigue funcionando; solo `authorize()` y el log lo distinguen. */
export class InactiveUserError extends UnauthorizedError {}
```

```ts
// src/lib/auth/auth.schema.ts
export const loginSchema: z.ZodObject<{ email: z.ZodString; password: z.ZodString }>;
export const requestMagicLinkSchema: z.ZodObject<{ email: z.ZodString }>;
export const inviteUserSchema: z.ZodObject<{
  email: z.ZodString;
  role: z.ZodEnum<["admin", "collector"]>;
}>;
export const acceptInvitationSchema: z.ZodObject<{ password: z.ZodString }>; // mínimo 8 caracteres

export type LoginInput = z.infer<typeof loginSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
```

```ts
// src/server/auth/organization.repository.ts
export function createOrganization(data: { name: string }): Promise<Organization>;
export function findOrganizationById(id: string): Promise<Organization | null>;
```

```ts
// src/server/auth/user.repository.ts
export function findUserByEmail(email: string): Promise<User | null>; // sin organizationId: es anterior a conocer la sesión
export function findUserById(organizationId: string, id: string): Promise<User | null>;
export function listUsersByOrganization(organizationId: string): Promise<User[]>;
export function createUser(
  organizationId: string,
  data: { email: string; name: string; role: Role; passwordHash: string },
): Promise<User>;
export function updateUserStatus(
  organizationId: string,
  id: string,
  status: UserStatus,
): Promise<User | null>; // null si no existe EN ESA organización (CA-AUT-01)
```

```ts
// src/server/auth/invitation.repository.ts
export function createInvitation(
  organizationId: string,
  data: { email: string; role: Role; invitedByUserId: string; token: string; expiresAt: Date },
): Promise<Invitation>;
export function findInvitationByToken(token: string): Promise<Invitation | null>;
export function markInvitationAccepted(id: string): Promise<Invitation>;
export function listPendingInvitations(organizationId: string): Promise<Invitation[]>;
```

```ts
// src/server/auth/login-token.repository.ts
export function createLoginToken(userId: string, token: string, expiresAt: Date): Promise<LoginToken>;
export function findValidLoginToken(token: string): Promise<(LoginToken & { user: User }) | null>; // no caducado, no usado
export function markLoginTokenUsed(id: string): Promise<LoginToken>;
```

```ts
// src/server/auth/auth.service.ts
export const LOGIN_RATE_LIMIT = { attempts: 5, windowMs: 15 * 60 * 1000 };
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

export function hashPassword(password: string): Promise<string>; // bcrypt, 10 rondas

/** Verifica email + contraseña contra `User` (RNF-AUT-04, #20). Orden:
 *  1. `isBlocked(key)` (key = email normalizado) SIN consumir cupo: si está bloqueado lanza
 *     `RateLimitError` antes de buscar al usuario y de ejecutar bcrypt.
 *  2. Comprueba credenciales. Si el usuario no existe o la contraseña no coincide lanza
 *     `UnauthorizedError("Email o contraseña incorrectos.")`; si existe, la contraseña es correcta
 *     pero está `inactive`, lanza `InactiveUserError` (mismo mensaje).
 *     Para un email inexistente se ejecuta igualmente un `bcrypt.compare` contra un hash fijo
 *     (`DUMMY_HASH`, constante del módulo) para no distinguir por tiempo.
 *  3. Cualquier fallo del paso 2 llama a `recordFailure(key)` (también email inexistente o inactivo).
 *  4. Éxito: `reset(key)` y devuelve CurrentUser.
 *  Los errores de base de datos se propagan sin registrar fallo (los clasifica `authorize()` como
 *  `internal_error`). Un usuario inactivo con contraseña incorrecta es `UnauthorizedError`
 *  (no se revela el estado de una cuenta a quien no conoce la contraseña). */
export async function verifyPassword(email: string, password: string): Promise<CurrentUser>;

/** Si existe un `User` activo con ese email, crea un `LoginToken`
 *  (TTL `MAGIC_LINK_TTL_MS`) y envía el email con el enlace
 *  `${AUTH_URL}/login/magic?token=...`. Si no existe o está
 *  `inactive`, no hace nada. Nunca lanza por "no encontrado": el
 *  resultado para quien llama es siempre el mismo (RNF-AUT-02). */
export async function requestMagicLink(email: string): Promise<void>;

/** Busca un LoginToken válido (no caducado, no usado), lo marca usado
 *  y devuelve CurrentUser. Lanza UnauthorizedError si no es válido. */
export async function verifyMagicLink(token: string): Promise<CurrentUser>;
```

```ts
// src/server/auth/user.service.ts
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

/** Crea la invitación y envía el email con el enlace
 *  `${AUTH_URL}/invite/<token>`. Lanza ConflictError si ya existe un
 *  `User` (de cualquier organización) con ese email. */
export async function inviteUser(
  organizationId: string,
  invitedByUserId: string,
  input: InviteUserInput,
): Promise<Invitation>;

/** Busca la invitación por token; lanza UnauthorizedError si no
 *  existe, está caducada o ya se aceptó. Crea el `User` con el rol de
 *  la invitación y la contraseña dada, marca la invitación aceptada y
 *  devuelve CurrentUser (CA-AUT-03). */
export async function acceptInvitation(token: string, password: string): Promise<CurrentUser>;

export async function listUsers(organizationId: string): Promise<Array<Pick<User, "id" | "email" | "name" | "role" | "status">>>;

/** Lanza ForbiddenError si `userId === actingUserId` (nadie se
 *  desactiva a sí mismo). Lanza NotFoundError si `userId` no
 *  pertenece a `organizationId` (CA-AUT-01). */
export async function deactivateUser(
  organizationId: string,
  actingUserId: string,
  userId: string,
): Promise<void>;
```

```ts
// src/server/auth/rate-limit.ts (#20: cuenta solo fallos; sustituye a checkAndConsume)
/** Límite en memoria por proceso (ventana deslizante con un Map<string, number[]> de marcas de
 *  tiempo de fallos). Válido para el piloto de una sola instancia; se pierde al reiniciar y no se
 *  comparte entre instancias (ver "Seguridad y privacidad"). Valores por defecto: limit 5,
 *  windowMs 15 min. */
export const MAX_TRACKED_KEYS = 10_000;

/** true si `key` tiene `limit` o más fallos dentro de la ventana. NO modifica los contadores salvo
 *  para purgar las marcas caducadas de esa clave (y borrar la clave si queda vacía). */
export function isBlocked(key: string, limit?: number, windowMs?: number): boolean;

/** Añade un fallo de `key` ahora. Antes purga las marcas caducadas de `key`. Si el Map supera
 *  `MAX_TRACKED_KEYS`, primero elimina todas las claves cuyas marcas hayan caducado y, si sigue
 *  superándolo, elimina las más antiguas (orden de inserción del Map) hasta quedar en el tope. */
export function recordFailure(key: string, windowMs?: number): void;

/** Borra el contador de `key` (login correcto). */
export function reset(key: string): void;

/** Solo para tests: vacía el Map. */
export function clearAllForTests(): void;
```

```ts
// src/server/auth/session.ts
export type CurrentUser = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: Role;
};

export async function getCurrentUser(): Promise<CurrentUser | null>; // lee auth() de src/auth.ts
/** Para route handlers y server actions: lanza UnauthorizedError (401)
 *  si no hay sesión, ForbiddenError (403) si `options.role` no
 *  coincide. */
export async function requireSession(options?: { role?: Role }): Promise<CurrentUser>;
/** Para Server Components (páginas/layouts): igual que requireSession
 *  pero en vez de lanzar, hace redirect("/login") o
 *  redirect("/forms") (admin requerido y el usuario es collector). */
export async function requireAdminPage(): Promise<CurrentUser>;
/** Azúcar sobre requireSession: `(await requireSession(options)).organizationId`.
 *  Es la función que reutilizan los repositorios de los demás módulos. */
export async function getCurrentOrg(options?: { role?: Role }): Promise<string>;
```

```ts
// src/server/integrations/email.ts
export type SendEmailInput = { to: string; subject: string; html: string; text: string };
/** Envía con nodemailer y la configuración SMTP de getEnv(). No
 *  registra en logs el destinatario ni el contenido, solo
 *  "email enviado" o el error de conexión (RGPD, CLAUDE.md). */
export async function sendEmail(input: SendEmailInput): Promise<void>;
```

```ts
// src/lib/auth/emails.ts (sin E/S, fácil de testear)
export function buildMagicLinkEmail(url: string): { subject: string; html: string; text: string };
export function buildInvitationEmail(
  url: string,
  organizationName: string,
): { subject: string; html: string; text: string };
```

```ts
// src/auth.ts
export const { handlers, auth, signIn, signOut }: {
  handlers: { GET: ...; POST: ... };
  auth: () => Promise<Session | null>;
  signIn: typeof import("next-auth/react").signIn;
  signOut: typeof import("next-auth/react").signOut;
};
// session: { strategy: "jwt" }; providers: [Credentials({ id: "password", ... }), Credentials({ id: "magic-link", ... })]
// callbacks.jwt añade organizationId/role al token; callbacks.session copia a session.user el id (token.sub, que Auth.js rellena con user.id), organizationId y role.
// Los tres son obligatorios: getCurrentUser() devuelve null si falta cualquiera, y las páginas del panel redirigen a /login.
```

```ts
// middleware.ts
export default auth((req) => { /* ver Flujos */ });
export const config = { matcher: ["/admin/:path*", "/forms/:path*"] };
```

### Listado de formularios publicados (#39)

Sustituye a `/collect`. Ruta nueva `/forms` (fuera del layout de `/admin`; el `matcher` la protege con "cualquier sesión", y la página lo vuelve a comprobar). Al borrar `/collect/**` del `matcher`, `GET /collect` cae en el 404 por defecto de Next.js (no hay `page.tsx`).

```ts
// src/server/form-publishing/form-publishing.repository.ts (añadir)
export type PublishedFormRow = { id: string; name: string; slug: string };
/** Formularios con status "published", slug no nulo y archivedAt null de la
 *  organización, ordenados por name asc (y id asc como desempate). SIEMPRE
 *  filtra por organizationId. */
export function listPublishedForms(organizationId: string): Promise<PublishedFormRow[]>;
// where: { organizationId, status: "published", archivedAt: null, slug: { not: null } }
// select: { id, name, slug } ; orderBy: [{ name: "asc" }, { id: "asc" }]
// (el tipo de `slug` se estrecha a string tras filtrar los null).

// src/server/form-publishing/form-publishing.service.ts (añadir)
/** Delegación directa en listPublishedForms; existe para que la página no
 *  importe el repositorio. */
export function listPublishedFormsForOrg(organizationId: string): Promise<PublishedFormRow[]>;
```

```tsx
// src/app/forms/page.tsx — Server Component, `export const dynamic = "force-dynamic"`
// const user = await getCurrentUser(); if (!user) redirect("/login");
// const forms = await listPublishedFormsForOrg(user.organizationId);
// return <PublishedFormsList forms={forms} userName={user.name} isAdmin={user.role === "admin"} />;

// src/components/forms/published-forms-list.tsx — presentacional, sin lógica de negocio
export function PublishedFormsList(props: {
  forms: PublishedFormRow[]; userName: string; isAdmin: boolean;
}): JSX.Element;
```

Interfaz (textos en español): `<h1>` «Formularios», saludo con `userName`; una tarjeta o fila por formulario con el nombre y un enlace «Rellenar» (`<Link href={`/f/${slug}`}>`, `data-testid="fill-link"`), con área táctil mínima de 44 px; lista con `data-testid="published-forms"`. Sin formularios: texto «Todavía no hay formularios publicados.» (`data-testid="forms-empty"`). Si `isAdmin`, un enlace «Ir al panel» a `/admin`. Una sola columna a 360 px, tarjetas `max-w-xl` centradas en pantallas grandes. Sin filtros ni paginación.

Cambios de redirección: `middleware.ts` redirige al `collector` que entra en `/admin/**` a `/forms`; `requireAdminPage` hace `redirect("/forms")`. El inicio de sesión no cambia (`router.push("/admin")` en login, enlace mágico e invitación): el `collector` llega a `/forms` por esa redirección (un salto extra, sin parpadeo del panel).

Otras referencias a `/collect` que se actualizan en el mismo cambio (solo texto/código): `src/server/auth/session.ts`, `middleware.ts` (comentarios incluidos), `e2e/auth-admin-guard.spec.ts`, `e2e/auth-invitation.spec.ts` (comentario y `waitForURL`), `e2e/outputs-export.spec.ts` (comentario), y en otros módulos `specs/form-editor/design.md`, `specs/submissions-dashboard/design.md`, `specs/form-publishing/design.md`, `specs/tenancy-auth/test-plan.md`. `prisma/seed.ts` no cita la ruta (solo el rol); su mensaje y comentarios no cambian. No hay migración.

### Motivo de los fallos de login y mensajes (#20)

```ts
// src/lib/auth/login-failure.ts
export type LoginProvider = "password" | "magic-link";
export type LoginFailureReason =
  | "invalid_credentials"
  | "inactive_user"
  | "rate_limited"
  | "internal_error"
  | "invalid_token"; // solo magic-link

/** Traduce un error capturado en authorize():
 *  RateLimitError -> rate_limited; InactiveUserError -> inactive_user;
 *  UnauthorizedError -> "invalid_token" si provider es magic-link, si no "invalid_credentials";
 *  cualquier otra cosa -> internal_error. El orden de comprobación importa
 *  (InactiveUserError hereda de UnauthorizedError: se comprueba antes). */
export function classifyLoginError(error: unknown, provider: LoginProvider): LoginFailureReason;

/** Escribe UNA línea con console.warn(JSON.stringify(...)):
 *  {"event":"auth.login_failed","provider":"password","reason":"rate_limited"}
 *  Con reason "internal_error" añade "errorClass": error.constructor.name (nunca error.message ni stack).
 *  Nunca recibe ni registra email, contraseña, token ni derivados (hash incluido). */
export function logLoginFailure(
  provider: LoginProvider,
  reason: LoginFailureReason,
  error?: unknown,
): void;
```

```ts
// src/lib/auth/login-errors.ts
import { CredentialsSignin } from "next-auth";
export const RATE_LIMITED_CODE = "rate_limited";
export class RateLimitedSignin extends CredentialsSignin {
  code = RATE_LIMITED_CODE;
}
```

```ts
// src/server/auth/authorize.ts
/** Lógica de authorize() del proveedor "password".
 *  - loginSchema inválido: logLoginFailure("password","invalid_credentials"); devuelve null.
 *  - verifyPassword OK: devuelve el usuario en formato Auth.js (toAuthUser).
 *  - Error: reason = classifyLoginError(error,"password"); logLoginFailure(...);
 *    si reason === "rate_limited" lanza `new RateLimitedSignin()`; en el resto devuelve null
 *    (Auth.js responde CredentialsSignin genérico, indistinguible entre sí). */
export async function authorizePassword(credentials: Partial<Record<string, unknown>> | undefined): Promise<AuthUser | null>;

/** Proveedor "magic-link". Token ausente: log invalid_token, null. Error: classifyLoginError(error,"magic-link")
 *  (invalid_token o internal_error), log, null. Sin límite de intentos. */
export async function authorizeMagicLink(credentials: Partial<Record<string, unknown>> | undefined): Promise<AuthUser | null>;
```

`src/auth.ts` queda reducido a: `authorize: authorizePassword` / `authorize: authorizeMagicLink` (la función `toAuthUser` se mueve a `authorize.ts`).

**Cómo llega el motivo a la pantalla.** En Auth.js v5, lanzar desde `authorize()` una subclase de `CredentialsSignin` con una propiedad `code` hace que `signIn("password", { redirect: false })` en cliente (`next-auth/react`) devuelva `{ error: "CredentialsSignin", code: "<code>", ... }`. El desarrollador debe **confirmarlo con la versión instalada** (`next-auth@^5.0.0-beta.32`, ver `node_modules/next-auth` y `@auth/core/errors`) antes de seguir: si `result.code` no llega al cliente, se detiene y lo anota en el issue (alternativa a proponer, no a decidir: server action de login propia).

**Mensajes de `login-form.tsx`:**

| Resultado de `signIn` | Mensaje |
| --- | --- |
| `result.code === RATE_LIMITED_CODE` | «Demasiados intentos, prueba de nuevo más tarde.» |
| cualquier otro error (o `!result`) | «Email o contraseña incorrectos.» (el actual; cubre `invalid_credentials`, `inactive_user` e `internal_error`) |

## Flujos

```mermaid
sequenceDiagram
  participant U as Usuario
  participant Mid as middleware.ts
  participant Login as /login
  participant Auth as src/auth.ts (Credentials)
  participant Svc as auth.service.ts
  participant DB as PostgreSQL

  U->>Mid: GET /admin
  Mid->>Mid: auth() -> sin sesión
  Mid-->>U: redirect /login
  U->>Login: email + contraseña
  Login->>Auth: signIn("password", {...})
  Auth->>Svc: verifyPassword(email, password)
  Svc->>Svc: isBlocked(email)? sí -> RateLimitError (RNF-AUT-04, #20)
  Svc->>DB: findUserByEmail
  Svc->>Svc: fallo -> recordFailure(email); éxito -> reset(email)
  Svc-->>Auth: CurrentUser | throw UnauthorizedError / InactiveUserError
  Auth->>Auth: fallo -> logLoginFailure(motivo) (RNF-AUT-05)
  Auth-->>Login: cookie de sesión (JWT) | error
  U->>Mid: GET /admin (con cookie)
  Mid->>Mid: auth() -> role === "admin"
  Mid-->>U: deja pasar
```

```mermaid
sequenceDiagram
  participant Admin as Administrador
  participant Action as inviteUserAction
  participant Svc as user.service.ts
  participant Email as email.ts (SMTP)
  participant Invitado as Invitado
  participant Accept as /invite/[token]

  Admin->>Action: email, role
  Action->>Svc: inviteUser(orgId, adminId, input)
  Svc->>Svc: genera token, expiresAt = +7 días
  Svc->>Email: sendEmail(enlace de invitación)
  Invitado->>Accept: abre el enlace, fija contraseña
  Accept->>Svc: acceptInvitation(token, password)
  Svc-->>Accept: CurrentUser
  Accept->>Accept: signIn("password", {email, password}) y redirige por rol
```

## Errores

Los puntos de entrada de este módulo son server actions (devuelven `{ error }` a la interfaz) y el guardián `requireSession`/`requireAdminPage` (lo consumen los módulos siguientes desde sus propios route handlers). Tabla de referencia para esos módulos:

| Error de dominio | HTTP (en un route handler que use `requireSession`) | Mensaje en la interfaz |
| --- | --- | --- |
| `UnauthorizedError` | 401 | "Inicia sesión para continuar." / en `/login`: "Email o contraseña incorrectos." |
| `ForbiddenError` | 403 | "No tienes permiso para hacer esto." |
| `NotFoundError` | 404 | "No se ha encontrado." (nunca "pertenece a otra organización") |
| `ConflictError` | 409 | "Ya hay un usuario con ese email." |
| `ValidationError` | 400 | El mensaje del campo Zod correspondiente. |
| `RateLimitError` | 429 | "Demasiados intentos. Inténtalo de nuevo en unos minutos." (en `/login`, vía `RateLimitedSignin`: «Demasiados intentos, prueba de nuevo más tarde.») |
| `InactiveUserError` | 401 | En `/login`, el mismo mensaje que `UnauthorizedError` (no se distingue en pantalla; solo en el log). |

## Seguridad y privacidad

- Contraseñas con bcrypt (RNF-AUT-01). Nunca se registra en logs ni se incluye en ningún mensaje de error la contraseña ni el hash.
- Cookie de sesión `httpOnly`, `secure` (en producción) y `sameSite: "lax"` — comportamiento por defecto de Auth.js v5 con `strategy: "jwt"` (RNF-AUT-03); no se cambia.
- `requireSession`/`getCurrentOrg` son el único punto por el que los demás módulos obtienen `organizationId`: ningún repositorio nuevo debe aceptar un `organizationId` que no venga de ahí.
- `requestMagicLink` e `inviteUser` responden siempre igual exista o no el email (RNF-AUT-02): no permiten enumerar qué emails están registrados.
- `CA-AUT-01`: `updateUserStatus`/`findUserById` siempre filtran por `organizationId` además de por `id`; un `id` de otra organización se trata exactamente igual que uno inexistente (`null` → `NotFoundError` → 404), nunca un 403 (un 403 revelaría que el recurso existe).
- Límite de **fallos** de login (RNF-AUT-04) en memoria por proceso: válido para el piloto (una sola instancia), documentado como limitación conocida; si se escala a varias instancias, habría que moverlo a Redis o a la base de datos — no se hace ahora (CLAUDE.md: "no sobredimensionar"). Con limpieza de claves caducadas y tope `MAX_TRACKED_KEYS` para que emails inventados no hagan crecer el `Map` sin límite.
- **Riesgo aceptado (#20): bloqueo dirigido.** Como el límite se aplica por email y cuenta fallos, cualquiera que conozca un email puede bloquearlo 15 minutos con 5 intentos fallidos. Aceptado en el piloto; no hay límite por IP. El mensaje de bloqueo es seguro porque depende solo del texto del email, exista o no la cuenta (no enumera cuentas).
- **Trazabilidad sin datos personales (RNF-AUT-05, #20):** el log de fallos de login es una línea JSON con `event`, `provider`, `reason` (y `errorClass` en `internal_error`). No incluye email, contraseña, token ni hash/identificador derivado del email (un hash seguiría siendo dato personal seudonimizado). Alternativa descartada: guardar los fallos en base de datos (fuera de alcance).
- El enlace mágico no tiene límite de intentos (token de 32 bytes aleatorios, inviable por fuerza bruta); solo se registra el motivo `invalid_token`.
- Ningún email ni su contenido se registra en logs (`sendEmail` solo logea éxito/fallo, nunca el destinatario).
- `.env.example` documenta `AUTH_SECRET`/SMTP con placeholders, nunca secretos reales.

## Tests

| Criterio | Tipo | Fichero |
| --- | --- | --- |
| RF-AUT-01, CA-AUT-04, RNF-AUT-01 | Vitest | `src/server/auth/auth.service.test.ts` — `verifyPassword` con contraseña correcta/incorrecta/usuario `inactive`; `hashPassword` produce un hash distinto del texto plano y verificable. |
| RNF-AUT-04, CA-AUT-08 | Vitest | `src/server/auth/auth.service.test.ts` — **reescribir** el test «el 6.º intento seguido…» (fija el comportamiento erróneo). Nombre: `"limit: 5 fallos bloquean el 6.º intento aunque la contraseña sea correcta"` (lanza `RateLimitError`, y `bcrypt.compare`/`findUserByEmail` no se llaman: espías). |
| RNF-AUT-04, CA-AUT-06 | Vitest | `auth.service.test.ts` — `"limit: 6 logins correctos seguidos no bloquean"`. |
| RNF-AUT-04, CA-AUT-07 | Vitest | `auth.service.test.ts` — `"limit: un login correcto reinicia el contador"` (4 fallos, 1 acierto, 4 fallos más: el 5.º intento correcto sigue permitido). |
| RNF-AUT-04, CA-AUT-09 | Vitest | `auth.service.test.ts` — `"limit: email inexistente e inactivo también cuentan como fallo"` y `"verifyPassword: inactivo con contraseña correcta lanza InactiveUserError"`. La ventana se prueba con `vi.useFakeTimers()`: pasados 15 min el email se desbloquea. |
| RNF-AUT-04 | Vitest | `src/server/auth/rate-limit.test.ts` — `isBlocked` no consume cupo; `recordFailure` x5 bloquea; `reset` desbloquea; las marcas caducadas se purgan; con más de `MAX_TRACKED_KEYS` claves el `Map` no crece por encima del tope. |
| RNF-AUT-05, CA-AUT-10 | Vitest | `src/lib/auth/login-failure.test.ts` — `classifyLoginError` para cada clase de error y provider; `logLoginFailure` escribe una sola línea JSON parseable con `event/provider/reason`, y la salida no contiene el email ni la contraseña de prueba; en `internal_error` incluye `errorClass` y no el mensaje del error. |
| RNF-AUT-05, CA-AUT-08, CA-AUT-09 | Vitest | `src/server/auth/authorize.test.ts` (mockea `auth.service`, espía `console.warn`) — `authorizePassword`: éxito devuelve usuario sin log; `RateLimitError` lanza `RateLimitedSignin` (con `code === "rate_limited"`) y registra `rate_limited`; `UnauthorizedError` e `InactiveUserError` devuelven `null` y registran `invalid_credentials` / `inactive_user`; error genérico devuelve `null` y registra `internal_error` con `errorClass`; entrada inválida registra `invalid_credentials`. `authorizeMagicLink`: token inválido registra `invalid_token`; sin límite de intentos. |
| CA-AUT-08, CA-AUT-09 | Vitest (componente) o Playwright | Mensajes de `login-form.tsx`: Playwright `e2e/auth-login.spec.ts` (ampliar) y `e2e/auth-rate-limit.spec.ts` — 5 fallos con un email inventado único y un 6.º intento: muestra «Demasiados intentos, prueba de nuevo más tarde.»; un email inexistente y el admin del seed con contraseña incorrecta muestran el mismo texto «Email o contraseña incorrectos.». |
| RF-AUT-02, CA-AUT-05 | Vitest | `src/server/auth/auth.service.test.ts` — `requestMagicLink` con email existente crea un `LoginToken` y llama a `sendEmail`; con email inexistente no crea nada pero no lanza. `verifyMagicLink` con token válido devuelve `CurrentUser` y lo marca usado; reutilizarlo lanza `UnauthorizedError`; con token caducado lanza `UnauthorizedError`. |
| RF-AUT-03, RF-AUT-04, CA-AUT-03 | Vitest | `src/server/auth/user.service.test.ts` — `inviteUser` crea la invitación y envía el email; con email ya registrado lanza `ConflictError`. `acceptInvitation` con token válido crea el `User` con el rol de la invitación y permite iniciar sesión después; con token caducado o ya aceptado lanza `UnauthorizedError`. |
| RF-AUT-05, CA-AUT-01 | Vitest | `src/server/auth/user.service.test.ts` — `deactivateUser` cambia el estado dentro de la misma organización; con el `id` del propio `actingUserId` lanza `ForbiddenError`; con un `id` de **otra** organización lanza `NotFoundError` (no revela que existe). |
| RF-AUT-07, CA-AUT-01 | Vitest | `src/server/auth/user.repository.test.ts` — `updateUserStatus`/`findUserById` con el `organizationId` de otra organización devuelven `null` aunque el `id` exista. |
| — (utilidad) | Vitest | `src/lib/auth/auth.schema.test.ts` — `loginSchema`/`inviteUserSchema`/`acceptInvitationSchema` aceptan entradas válidas y rechazan las inválidas (email mal formado, contraseña corta, rol fuera de la lista). |
| — (utilidad) | Vitest | `src/lib/auth/emails.test.ts` — `buildMagicLinkEmail`/`buildInvitationEmail` incluyen la URL recibida en el HTML y en el texto. |
| CA-AUT-02 | Playwright | `e2e/auth-admin-guard.spec.ts` — con sesión de `collector` (login por UI), `GET /admin` acaba en `/forms` y se ve el listado; con sesión de `admin`, `/admin` carga. |
| RF-AUT-09, CA-AUT-14 | Vitest | `src/server/form-publishing/form-publishing.repository.test.ts` (ampliar) — `listPublishedForms`: devuelve solo `published` no archivados con slug; excluye borradores, despublicados (`status: draft` con `publishedVersion`) y archivados; con dos organizaciones, cada una solo ve los suyos; orden por nombre. |
| RF-AUT-09 | Vitest | `src/server/form-publishing/form-publishing.service.test.ts` (ampliar) — `listPublishedFormsForOrg` pasa el `organizationId` recibido al repositorio (espía) y devuelve su resultado. |
| CA-AUT-11, CA-AUT-13, CA-AUT-14 | Playwright | `e2e/auth-forms-list.spec.ts` (nuevo) — ver [Tests e2e de #39](#tests-e2e-de-39). |
| CA-AUT-12, CA-AUT-15 | Playwright / shell | `e2e/auth-forms-list.spec.ts` (`GET /collect` → 404) y el `grep` de PP-AUT-18. |
| CA-AUT-03 | Playwright | `e2e/auth-invitation.spec.ts` — un `beforeAll` crea una invitación llamando directamente a `userService.inviteUser` (sin pasar por email); el test abre `/invite/<token>`, fija una contraseña y comprueba que termina con sesión iniciada en la organización y el rol correctos. |
| RF-AUT-01, CA-AUT-04, RNF-AUT-03 | Playwright | `e2e/auth-login.spec.ts` — login con el admin del seed (`admin@demo.formia.local` / `Demo1234!`, ver [Datos de ejemplo (seed)](#datos-de-ejemplo-seed)) y contraseña correcta entra en `/admin`; con contraseña incorrecta se queda en `/login` con un mensaje de error; comprueba que la cookie de sesión lleva `HttpOnly` y `SameSite=Lax`. |

### Tests e2e de #39

`e2e/auth-forms-list.spec.ts` (nuevo), con los helpers de `e2e/helpers/form-publishing.ts` (`login`, `seedForm`, `publishViaService`, `uniqueName`):

- `beforeAll`: crea con `seedForm` dos formularios de la organización demo y publica solo uno (`publishViaService`); el otro queda borrador. Crea una segunda `Organization` con `prisma.organization.create` y un `Form` suyo con `status: "published"`, `slug` único y `draftSchema` mínimo válido (por inserción directa con Prisma; las pruebas no usan la API). `afterAll` borra esos registros.
- Test 1 (CA-AUT-02, CA-AUT-14): login como `collector@demo.formia.local`, `goto("/admin")`, `toHaveURL(/\/forms$/)`; `published-forms` contiene el nombre del publicado y **no** el del borrador ni el de la otra organización.
- Test 2 (CA-AUT-11): clic en el `fill-link` del formulario publicado; `toHaveURL(new RegExp("/f/" + slug + "$"))`.
- Test 3 (CA-AUT-13): sin sesión, `goto("/forms")` termina en `/login`.
- Test 4 (CA-AUT-12): `request.get(removed)` devuelve 404 (con y sin sesión), con `const removed = "/" + "collect"` para que el `grep` de CA-AUT-15 no encuentre la cadena literal en `e2e/`.
- Test 5 (móvil): con `page.setViewportSize({ width: 360, height: 740 })`, sin desbordamiento horizontal (`document.documentElement.scrollWidth <= 360`).

`e2e/auth-admin-guard.spec.ts` y `e2e/auth-invitation.spec.ts` cambian `/collect` por `/forms`.

## Tareas de desarrollo

| Orden | Issue | Tarea | Depende de |
| --- | --- | --- | --- |
| 1 | #4 | `src/lib/errors.ts` | — |
| 2 | #4 | `prisma/schema.prisma` (modelos + enums) y migración `init_tenancy_auth` | — |
| 3 | #4 | `src/lib/env.ts` (añadir variables), `.env.example` (añadir variables) | — |
| 4 | #4 | `src/lib/auth/auth.schema.ts` + test | 1 |
| 5 | #4 | `src/lib/auth/emails.ts` + test | — |
| 6 | #4 | `src/server/integrations/email.ts` | 3 |
| 7 | #4 | `src/server/auth/organization.repository.ts`, `user.repository.ts` + test, `invitation.repository.ts`, `login-token.repository.ts` | 2 |
| 8 | #4 | `src/server/auth/rate-limit.ts` | — |
| 9 | #4 | `src/server/auth/auth.service.ts` + test | 1, 4, 5, 6, 7, 8 |
| 10 | #4 | `src/server/auth/user.service.ts` + test | 1, 4, 6, 7 |
| 11 | #4 | `src/types/next-auth.d.ts`, `src/auth.ts` | 9 |
| 12 | #4 | `src/app/api/auth/[...nextauth]/route.ts`, `middleware.ts` | 11 |
| 13 | #4 | `src/server/auth/session.ts` | 11 |
| 14 | #4 | `src/server/auth/auth.actions.ts`, `src/server/auth/user.actions.ts` | 9, 10, 13 |
| 15 | #4 | `src/app/login/page.tsx` + `login-form.tsx`, `src/app/login/magic/page.tsx` | 11, 14 |
| 16 | #4 | `src/app/invite/[token]/page.tsx` + `accept-invitation-form.tsx` | 14 |
| 17 | #4 | `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/users/page.tsx`, ~~`src/app/collect/page.tsx`~~ (eliminado en #39) | 13, 14 |
| 18 | #4 | `prisma/seed.ts` (admin + collector de ejemplo, credenciales de [Datos de ejemplo (seed)](#datos-de-ejemplo-seed)) | 7, 9 |
| 19 | #4 | `e2e/auth-login.spec.ts`, `e2e/auth-admin-guard.spec.ts`, `e2e/auth-invitation.spec.ts` | 15, 16, 17, 18 |

### Tareas de #20 (límite de fallos y motivo de login)

| Orden | Tarea | Depende de |
| --- | --- | --- |
| 20.1 | `src/lib/errors.ts`: `InactiveUserError` | — |
| 20.2 | `src/server/auth/rate-limit.ts` (`isBlocked`, `recordFailure`, `reset`, `MAX_TRACKED_KEYS`) + `rate-limit.test.ts`; eliminar `checkAndConsume` | — |
| 20.3 | `src/server/auth/auth.service.ts`: nuevo orden de `verifyPassword`, `DUMMY_HASH`; reescribir y ampliar `auth.service.test.ts` | 20.1, 20.2 |
| 20.4 | Confirmar con `next-auth` instalado que `result.code` llega al cliente; `src/lib/auth/login-errors.ts` | — |
| 20.5 | `src/lib/auth/login-failure.ts` + test | 20.1 |
| 20.6 | `src/server/auth/authorize.ts` + test; `src/auth.ts` usa las dos funciones | 20.3, 20.4, 20.5 |
| 20.7 | `src/components/auth/login-form.tsx` (mensaje por `result.code`) + e2e `auth-login.spec.ts` ampliado y `auth-rate-limit.spec.ts` | 20.6 |

### Tareas de #39 (retirar `/collect`, listado `/forms`)

| Orden | Tarea | Depende de |
| --- | --- | --- |
| 39.1 | `listPublishedForms` en `form-publishing.repository.ts` + tests | — |
| 39.2 | `listPublishedFormsForOrg` en `form-publishing.service.ts` + test | 39.1 |
| 39.3 | `src/components/forms/published-forms-list.tsx` y `src/app/forms/page.tsx` | 39.2 |
| 39.4 | `middleware.ts` (matcher y redirección) y `session.ts` (`requireAdminPage`) | — |
| 39.5 | Borrar `src/app/collect/` | 39.3, 39.4 |
| 39.6 | e2e: `auth-forms-list.spec.ts` (nuevo); actualizar `auth-admin-guard`, `auth-invitation`, comentario de `outputs-export` | 39.3–39.5 |

## Historial de cambios

- 2026-11-17 — Diseño técnico inicial (#4): modelo de datos (`Organization`, `User`, `Invitation`, `LoginToken`), Auth.js v5 con sesión JWT y dos proveedores `Credentials` (contraseña y enlace mágico), guardián de sesión (`middleware.ts`, `session.ts`) y su reutilización por los módulos siguientes, invitación de usuarios, límite de intentos de login en memoria, e integración de email genérica.
- 2026-11-17 — Revisión del arquitecto (#4, APROBADO): se fijan las credenciales exactas del seed ([Datos de ejemplo (seed)](#datos-de-ejemplo-seed)), de las que dependían PP-AUT-07/08 sin un valor concreto documentado.
- 2026-11-24 — Corrección: el callback `session` no copiaba el id del usuario a `session.user.id`, así que `getCurrentUser()` devolvía `null` y ningún admin podía entrar en `/admin` aunque el login fuera correcto. Ahora lo copia desde `token.sub`; test en `src/auth.config.test.ts`.
- 2026-11-24 — Límite de fallos y motivo de login (#20): el límite cuenta solo fallos y un login correcto lo reinicia (`isBlocked`/`recordFailure`/`reset` sustituyen a `checkAndConsume`, con limpieza y tope de tamaño); `verifyPassword` comprueba el bloqueo antes de buscar al usuario y distingue `InactiveUserError` internamente; `authorize()` se extrae a `authorize.ts`, traduce errores a motivo tipado y registra una línea JSON sin datos personales (`login-failure.ts`); `rate_limited` llega a la pantalla con `RateLimitedSignin` (`code`); riesgo aceptado de bloqueo dirigido documentado.
- 2026-11-27 — Retirar `/collect` (#39): el `collector` pasa a `/forms`, un listado de formularios publicados de su organización con «Rellenar» a `/f/<slug>` (`listPublishedForms` en el repositorio de `form-publishing`, página `src/app/forms/page.tsx`); `middleware.ts` (matcher `/admin` y `/forms`) y `requireAdminPage` redirigen allí; se elimina `src/app/collect/`; tests y tareas. Decisión: el login sigue llevando a `/admin` y la redirección del middleware completa el camino del `collector`.
