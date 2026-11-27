# Organizaciones, usuarios y autenticación — Plan de pruebas

- **Requisitos:** [README.md](README.md)
- **Diseño:** [design.md](design.md)
- **Responsable:** analyst-programmer (escribe en `design` y lo ejecuta en `testPR`), architect (revisa)
- **Issues:** #4 (diseño), #20 (límite de login y trazabilidad), #39 (retirar `/collect`)

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
  npx vitest run src/server/auth/auth.service.test.ts -t "limit: 5 fallos"
  ```
- **Resultado esperado:** código de salida 0 y al menos 1 test ejecutado; tras 5 fallos, el 6.º intento lanza `RateLimitError` sin llegar a comparar la contraseña. (Reformulado en #20: el filtro `-t` cambia al nuevo nombre del test; ver también PP-AUT-10 a PP-AUT-15.)

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
- **Resultado esperado:** código de salida 0; con sesión del `collector` del seed (`collector@demo.formia.local` / `Demo1234!`), `page.goto("/admin")` termina en `/forms`; con sesión del admin del seed (`admin@demo.formia.local` / `Demo1234!`), `/admin` responde 200.

### PP-AUT-09 — Aceptar invitación desde la interfaz

- **Cubre:** CA-AUT-03
- **Tipo:** automático (Playwright)
- **Precondiciones:** `npm run db:seed` ejecutado; el propio test crea la invitación llamando a `userService.inviteUser` en un `beforeAll` (sin pasar por email).
- **Pasos:**
  ```bash
  npx playwright test e2e/auth-invitation.spec.ts
  ```
- **Resultado esperado:** código de salida 0; tras fijar la contraseña en `/invite/<token>`, el test comprueba que termina con sesión iniciada (cookie de sesión presente) y en la ruta correspondiente a su rol (`/admin` si es `admin`, `/forms` si es `collector`).

### PP-AUT-10 — Los logins correctos no consumen cupo y reinician el contador

- **Cubre:** RNF-AUT-04, CA-AUT-06, CA-AUT-07
- **Tipo:** automático (Vitest)
- **Precondiciones:** preparación (base de datos arriba).
- **Pasos:**
  ```bash
  npx vitest run src/server/auth/auth.service.test.ts -t "limit: 6 logins correctos"
  npx vitest run src/server/auth/auth.service.test.ts -t "limit: un login correcto reinicia"
  ```
- **Resultado esperado:** código de salida 0 en ambos y 1 test ejecutado en cada uno (la salida de Vitest no dice «no tests»): 6 logins correctos seguidos no lanzan; tras 4 fallos y 1 acierto, otros 4 fallos no bloquean el siguiente intento correcto.

### PP-AUT-11 — Bloqueo tras 5 fallos y desbloqueo por ventana; email inexistente o inactivo cuentan

- **Cubre:** RNF-AUT-04, CA-AUT-08, CA-AUT-09
- **Tipo:** automático (Vitest)
- **Precondiciones:** preparación.
- **Pasos:**
  ```bash
  npx vitest run src/server/auth/auth.service.test.ts -t "limit:"
  npx vitest run src/server/auth/rate-limit.test.ts
  ```
- **Resultado esperado:** código de salida 0; 5 fallos bloquean el 6.º intento aunque la contraseña sea correcta; email inexistente e inactivo también cuentan como fallo; pasados 15 minutos (reloj simulado) el email se desbloquea; `isBlocked` no consume cupo; el `Map` respeta `MAX_TRACKED_KEYS`.

### PP-AUT-12 — Distinción interna de motivos (`InactiveUserError`) sin cambiar el mensaje

- **Cubre:** CA-AUT-09
- **Tipo:** automático (Vitest)
- **Precondiciones:** preparación.
- **Pasos:**
  ```bash
  npx vitest run src/server/auth/auth.service.test.ts -t "verifyPassword"
  ```
- **Resultado esperado:** código de salida 0; usuario inactivo con contraseña correcta lanza `InactiveUserError` (que es `UnauthorizedError`); contraseña incorrecta o email inexistente lanzan `UnauthorizedError` con el mismo mensaje «Email o contraseña incorrectos.».

### PP-AUT-13 — Log estructurado de fallos sin datos personales

- **Cubre:** RNF-AUT-05, CA-AUT-10
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna además de `npm ci` (no usa base de datos en `login-failure`).
- **Pasos:**
  ```bash
  npx vitest run src/lib/auth/login-failure.test.ts src/server/auth/authorize.test.ts
  ```
- **Resultado esperado:** código de salida 0; una única línea JSON por fallo con `event: "auth.login_failed"`, `provider` y `reason` correctos para `invalid_credentials`, `inactive_user`, `rate_limited`, `internal_error` (con `errorClass`, sin mensaje) e `invalid_token`; la salida de `console.warn` no contiene el email ni la contraseña usados en el test; un login correcto no escribe nada.

### PP-AUT-14 — Comprobación estática: no se registra el email

- **Cubre:** RNF-AUT-05
- **Tipo:** automático (shell)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  ! grep -nE "console\.(log|warn|error|info)" src/server/auth/auth.service.ts src/server/auth/authorize.ts src/server/auth/rate-limit.ts
  grep -c "console.warn" src/lib/auth/login-failure.ts
  ! grep -rn "checkAndConsume" src
  ```
- **Resultado esperado:** el primer comando no encuentra nada (código 0 por la negación); el segundo imprime `1`; el tercero no encuentra referencias a `checkAndConsume` (código 0).

### PP-AUT-15 — Mensajes de la pantalla de login (e2e)

- **Cubre:** CA-AUT-08, CA-AUT-09
- **Tipo:** automático (Playwright)
- **Precondiciones:** `npm run db:seed` ejecutado.
- **Pasos:**
  ```bash
  npx playwright test e2e/auth-login.spec.ts e2e/auth-rate-limit.spec.ts
  ```
- **Resultado esperado:** código de salida 0; un email inexistente y el admin del seed con contraseña incorrecta muestran exactamente «Email o contraseña incorrectos.»; tras 5 fallos con un email inventado único, el 6.º intento muestra «Demasiados intentos, prueba de nuevo más tarde.». Los tests no bloquean las cuentas del seed (usan emails inventados para el bloqueo).

### PP-AUT-16 — Listado de formularios publicados (repositorio y servicio)

- **Cubre:** RF-AUT-09, CA-AUT-14
- **Tipo:** automático (Vitest)
- **Precondiciones:** preparación (base de datos arriba).
- **Pasos:**
  ```bash
  npx vitest run src/server/form-publishing/form-publishing.repository.test.ts -t "listPublishedForms"
  npx vitest run src/server/form-publishing/form-publishing.service.test.ts -t "listPublishedFormsForOrg"
  ```
- **Resultado esperado:** código de salida 0 y al menos 1 test ejecutado en cada comando; el repositorio devuelve solo formularios publicados, no archivados y con slug, nunca los de otra organización ni borradores/despublicados; el servicio pasa el `organizationId` al repositorio.

### PP-AUT-17 — Collector: `/admin` lleva al listado; «Rellenar»; sin sesión; aislamiento; `/collect` da 404

- **Cubre:** CA-AUT-02, CA-AUT-11, CA-AUT-12, CA-AUT-13, CA-AUT-14
- **Tipo:** automático (Playwright)
- **Precondiciones:** `npm run db:seed` ejecutado; el propio test crea sus formularios y una segunda organización en `beforeAll` y los borra en `afterAll`.
- **Pasos:**
  ```bash
  npx playwright test e2e/auth-forms-list.spec.ts e2e/auth-admin-guard.spec.ts e2e/auth-invitation.spec.ts
  ```
- **Resultado esperado:** código de salida 0; el `collector` del seed que abre `/admin` acaba en `/forms` y ve el formulario publicado pero no el borrador ni el de la otra organización; el enlace «Rellenar» lleva a `/f/<slug>`; sin sesión `/forms` termina en `/login`; `GET /collect` responde 404 con y sin sesión; en 360 px no hay desbordamiento horizontal.

### PP-AUT-18 — No quedan referencias a `/collect`

- **Cubre:** CA-AUT-12, CA-AUT-15
- **Tipo:** automático (shell)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  test ! -e src/app/collect
  ! grep -rnE "/collect([^o]|$)" src middleware.ts e2e prisma
  ```
- **Resultado esperado:** ambos comandos terminan con código 0: el directorio `src/app/collect` no existe y `grep` no encuentra ninguna línea con `/collect` (el patrón excluye `/collector`). Las rutas como `e2e/helpers` no se ven afectadas. El test e2e del 404 construye la ruta sin la cadena literal contigua (`const removed = "/" + "collect"`), para que este `grep` pueda pasar.

## Comprobaciones manuales

- [ ] `/forms` se ve bien en móvil (360 px) con varios formularios publicados: tarjetas legibles, botón «Rellenar» fácil de pulsar con el pulgar — Cubre: RF-AUT-09.
- [ ] El email de enlace mágico y el de invitación llegan a Mailpit (`http://localhost:8025`) con el enlace correcto y son legibles — Cubre: RF-AUT-02, RF-AUT-04.
- [ ] El formulario de login y el de aceptar invitación se ven bien en móvil (360 px) — Cubre: RNF-AUT-01 (experiencia), consistente con CLAUDE.md "móvil primero".
- [ ] Tras 6 intentos fallidos de login, el mensaje de "demasiados intentos" es comprensible para una persona no técnica — Cubre: RNF-AUT-04.
- [ ] Con `npm run dev`, un login fallido deja en la consola del servidor una línea `{"event":"auth.login_failed",...}` legible y sin el email — Cubre: RNF-AUT-05.

## Limpieza

```bash
docker compose down -v --remove-orphans
```

## Historial de cambios

- 2026-11-17 — Plan de pruebas inicial (#4): casos PP-AUT-01 a PP-AUT-09 para el login con contraseña, el enlace mágico, las invitaciones, el aislamiento por organización (CA-AUT-01), la autodesactivación bloqueada y el guardián de `/admin` (CA-AUT-02).
- 2026-11-17 — Revisión del arquitecto (#4, APROBADO): PP-AUT-07/08 fijan las credenciales exactas del seed (antes sin valor concreto); PP-AUT-07 añade la comprobación de los atributos `HttpOnly`/`SameSite` de la cookie de sesión (RNF-AUT-03).
- 2026-11-27 — Retirar `/collect` (#39): PP-AUT-08 y PP-AUT-09 esperan `/forms`; nuevos PP-AUT-16 a PP-AUT-18 (RF-AUT-09, CA-AUT-11 a CA-AUT-15) y una comprobación manual en móvil.
- 2026-11-24 — Límite de fallos y motivo de login (#20): PP-AUT-02 apunta al nuevo nombre de test; nuevos PP-AUT-10 a PP-AUT-15 (CA-AUT-06 a CA-AUT-10, RNF-AUT-04/05) y una comprobación manual del log.
