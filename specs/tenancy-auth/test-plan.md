# Organizaciones, usuarios y autenticación — Plan de pruebas

- **Requisitos:** [README.md](README.md)
- **Diseño:** [design.md](design.md)
- **Responsable:** analyst-programmer (escribe en `design` y lo ejecuta en `testPR`), architect (revisa)
- **Issues:** #4 (diseño)

Este plan se ejecuta en la etapa `testPR`, sobre la rama `issue-4` de la pull request y **antes de fusionarla**.

## Preparación

```bash
cp -n .env.example .env
npm ci
docker compose up -d --wait
npm run db:migrate
npm run db:seed
```

## Comprobaciones generales

| ID | Comando |
| --- | --- |
| PP-AUT-G1 | `npm run lint` |
| PP-AUT-G2 | `npm run typecheck` |
| PP-AUT-G3 | `npm test` |
| PP-AUT-G4 | `npm run build` |
| PP-AUT-G5 | `npm run test:e2e` |

## Casos de prueba

### PP-AUT-01 — Login con contraseña correcta e incorrecta

- **Cubre:** CA-AUT-04, RNF-AUT-01
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna además de la preparación.
- **Pasos:**
  ```bash
  npx vitest run src/server/auth/auth.service.test.ts
  ```
- **Resultado esperado:** código de salida 0; el fichero incluye casos con contraseña correcta (devuelve `CurrentUser`), incorrecta y usuario `inactive` (ambos lanzan `UnauthorizedError`).

### PP-AUT-02 — Límite de intentos de inicio de sesión

- **Cubre:** RNF-AUT-04
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npx vitest run src/server/auth/auth.service.test.ts -t "RateLimitError"
  ```
- **Resultado esperado:** código de salida 0; el test comprueba que el 6.º intento seguido con la misma contraseña incorrecta lanza `RateLimitError` sin llegar a comparar la contraseña.

### PP-AUT-03 — Enlace mágico: generación y verificación de token

- **Cubre:** CA-AUT-05
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npx vitest run src/server/auth/auth.service.test.ts -t "MagicLink"
  ```
- **Resultado esperado:** código de salida 0; `requestMagicLink` con email existente crea un token y llama a `sendEmail` (mockeado); con email inexistente no lanza; `verifyMagicLink` con token válido devuelve `CurrentUser` y lo invalida; reutilizarlo o usar uno caducado lanza `UnauthorizedError`.

### PP-AUT-04 — Invitar usuario y aceptar la invitación

- **Cubre:** CA-AUT-03
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npx vitest run src/server/auth/user.service.test.ts -t "invite"
  ```
- **Resultado esperado:** código de salida 0; `inviteUser` crea la invitación y llama a `sendEmail` (mockeado); con un email ya registrado lanza `ConflictError`; `acceptInvitation` con el token devuelto crea el `User` con el rol de la invitación; con el mismo token una segunda vez lanza `UnauthorizedError`.

### PP-AUT-05 — Aislamiento entre organizaciones (CA-AUT-01)

- **Cubre:** CA-AUT-01, RF-AUT-07
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna (el test crea sus propias dos organizaciones).
- **Pasos:**
  ```bash
  npx vitest run src/server/auth/user.service.test.ts -t "otra organizacion"
  npx vitest run src/server/auth/user.repository.test.ts
  ```
- **Resultado esperado:** código de salida 0 en ambos; `deactivateUser(orgA, adminA.id, userDeOrgB.id)` lanza `NotFoundError` (no `ForbiddenError`); `updateUserStatus`/`findUserById` con el `organizationId` de otra organización devuelven `null` aunque el `id` exista.

### PP-AUT-06 — Autodesactivación bloqueada

- **Cubre:** RF-AUT-05
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npx vitest run src/server/auth/user.service.test.ts -t "a si mismo"
  ```
- **Resultado esperado:** código de salida 0; `deactivateUser(orgId, adminId, adminId)` lanza `ForbiddenError`.

### PP-AUT-07 — Login por la interfaz (admin del seed)

- **Cubre:** CA-AUT-04, RNF-AUT-03
- **Tipo:** automático (Playwright)
- **Precondiciones:** `npm run db:seed` ejecutado (preparación); requiere `npm run build` previo o el `webServer` de Playwright.
- **Pasos:**
  ```bash
  npx playwright test e2e/auth-login.spec.ts
  ```
- **Resultado esperado:** código de salida 0; con `admin@demo.formia.local` / `Demo1234!` (credenciales del seed, ver `design.md#datos-de-ejemplo-seed`), `/login` termina en `/admin`; con una contraseña incorrecta, se queda en `/login` mostrando un mensaje de error, sin sesión; el test también comprueba que la cookie de sesión se envía con los atributos `HttpOnly` y `SameSite=Lax` (`secure` no aplica en `http://localhost` de desarrollo) (RNF-AUT-03).

### PP-AUT-08 — Un `collector` no entra en `/admin`

- **Cubre:** CA-AUT-02
- **Tipo:** automático (Playwright)
- **Precondiciones:** `npm run db:seed` ejecutado.
- **Pasos:**
  ```bash
  npx playwright test e2e/auth-admin-guard.spec.ts
  ```
- **Resultado esperado:** código de salida 0; con sesión del `collector` del seed (`collector@demo.formia.local` / `Demo1234!`), `page.goto("/admin")` termina en `/collect`; con sesión del admin del seed (`admin@demo.formia.local` / `Demo1234!`), `/admin` responde 200.

### PP-AUT-09 — Aceptar invitación desde la interfaz

- **Cubre:** CA-AUT-03
- **Tipo:** automático (Playwright)
- **Precondiciones:** `npm run db:seed` ejecutado; el propio test crea la invitación llamando a `userService.inviteUser` en un `beforeAll` (sin pasar por email).
- **Pasos:**
  ```bash
  npx playwright test e2e/auth-invitation.spec.ts
  ```
- **Resultado esperado:** código de salida 0; tras fijar la contraseña en `/invite/<token>`, el test comprueba que termina con sesión iniciada (cookie de sesión presente) y en la ruta correspondiente a su rol (`/admin` si es `admin`, `/collect` si es `collector`).

## Comprobaciones manuales

- [ ] El email de enlace mágico y el de invitación llegan a Mailpit (`http://localhost:8025`) con el enlace correcto y son legibles — Cubre: RF-AUT-02, RF-AUT-04.
- [ ] El formulario de login y el de aceptar invitación se ven bien en móvil (360 px) — Cubre: RNF-AUT-01 (experiencia), consistente con CLAUDE.md "móvil primero".
- [ ] Tras 6 intentos fallidos de login, el mensaje de "demasiados intentos" es comprensible para una persona no técnica — Cubre: RNF-AUT-04.

## Limpieza

```bash
docker compose down -v --remove-orphans
```

## Historial de cambios

- 2026-11-17 — Plan de pruebas inicial (#4): casos PP-AUT-01 a PP-AUT-09 para el login con contraseña, el enlace mágico, las invitaciones, el aislamiento por organización (CA-AUT-01), la autodesactivación bloqueada y el guardián de `/admin` (CA-AUT-02).
- 2026-11-17 — Revisión del arquitecto (#4, APROBADO): PP-AUT-07/08 fijan las credenciales exactas del seed (antes sin valor concreto); PP-AUT-07 añade la comprobación de los atributos `HttpOnly`/`SameSite` de la cookie de sesión (RNF-AUT-03).
