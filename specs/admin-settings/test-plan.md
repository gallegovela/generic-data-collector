# Ajustes de administración y planes de uso — Plan de pruebas

- **Requisitos:** [README.md](README.md)
- **Diseño:** [design.md](design.md)
- **Responsable:** analyst-programmer (escribe en `design` y lo ejecuta en `testPR`), architect (revisa)
- **Issues:** #40

Este plan se ejecuta en la etapa `testPR`, sobre la rama `issue-40` de la pull request (con la última rama principal fusionada) y **antes de fusionarla**. Todo se ejecuta en el entorno de pruebas en contenedores (ver "Pruebas en contenedores" en `specs/platform/design.md`): cada comando va dentro del contenedor `tests` con `npm run test:stack:run -- <comando>`, y los servicios se llaman por su nombre (`web`, `postgres`, `minio`, `mailpit`), nunca `localhost`.

En todos los casos con `-t`, «al menos N tests» significa que Vitest informa de N o más tests pasados; **0 tests ejecutados es un fallo** aunque el código de salida sea 0.

## Preparación

```bash
npm run test:stack:up                            # imágenes de la rama, servicios, bucket, migraciones y app
npm run test:stack:run -- npm run db:seed        # plan «Genérico», organización y usuarios demo
```

## Comprobaciones generales

| ID | Comando |
| --- | --- |
| PP-SET-G1 | `npm run test:stack:run -- npm run lint` |
| PP-SET-G2 | `npm run test:stack:run -- npm run typecheck` |
| PP-SET-G3 | `npm run test:stack:run -- npm test` |
| PP-SET-G4 | `npm run test:stack:run -- npm run build` |
| PP-SET-G5 | `npm run test:stack:run -- npx playwright test` (el cambio toca `/admin` y el menú) |

## Casos de prueba

### PP-SET-01 — Acceso de ajustes solo para admin (servicio y acciones)

- **Cubre:** CA-SET-01, RF-SET-01
- **Tipo:** automático (Vitest)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/admin-settings/plan.actions.test.ts -t "acceso de ajustes"
  ```
- **Resultado esperado:** salida 0 y al menos 3 tests: sin sesión las acciones lanzan `UnauthorizedError`; con `collector` lanzan `ForbiddenError`; con `admin` funcionan. No se modifica ningún plan en los dos primeros casos.

### PP-SET-02 — Acceso de ajustes en el navegador

- **Cubre:** CA-SET-01, RF-SET-01, RF-SET-02
- **Tipo:** automático (Playwright)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx playwright test e2e/admin-settings-access.spec.ts
  ```
- **Resultado esperado:** salida 0: el `collector` que abre `/admin/settings` y `/admin/settings/plans` acaba en `/collect`; un anónimo acaba en `/login`; el `admin` ve el encabezado «Ajustes», el enlace «Planes» y llega a `/admin/settings/plans` al abrir `/admin/settings`; el menú de `/admin` muestra «Ajustes».

### PP-SET-03 — Gestión de planes en la interfaz

- **Cubre:** RF-SET-03, RF-SET-04, RF-SET-05, RF-SET-06
- **Tipo:** automático (Playwright)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx playwright test e2e/admin-settings-plans.spec.ts
  ```
- **Resultado esperado:** salida 0: el admin ve «Genérico» marcado como plan actual, crea un plan con nombre único y un límite vacío («Sin límite»), lo edita, lo asigna a su organización («Usar este plan»), comprueba que el botón de borrar está deshabilitado mientras esté asignado, vuelve a asignar «Genérico» y lo borra.

### PP-SET-04 — Borrado de planes y validación

- **Cubre:** CA-SET-09, RF-SET-03, RF-SET-05
- **Tipo:** automático (Vitest, Prisma real)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/admin-settings/plan.service.test.ts -t "borrado de planes"
  npm run test:stack:run -- npx vitest run src/lib/admin-settings
  ```
- **Resultado esperado:** ambos comandos con salida 0 (los dos son obligatorios). El primero con al menos 3 tests: borrar un plan con organizaciones → `ConflictError`; borrar el último plan → `ConflictError`; borrar un plan libre cuando hay otro → se elimina. El segundo ejecuta los tests de validación del esquema (límites 0, negativos o decimales rechazados, `null` aceptado) y de ventana/secciones, con al menos 1 test ejecutado.

### PP-SET-05 — Asignación de plan solo a la propia organización

- **Cubre:** CA-SET-10, RF-SET-06
- **Tipo:** automático (Vitest, Prisma real)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/admin-settings/plan.service.test.ts src/server/admin-settings/plan.actions.test.ts -t "asignación de plan"
  ```
- **Resultado esperado:** salida 0 y al menos 2 tests: el admin de A asigna el plan X y cambia la organización A, y la B sigue con su plan; un plan inexistente → `NotFoundError`.

### PP-SET-06 — Rechazo de la tercera recepción y reenvío idempotente

- **Cubre:** CA-SET-02, CA-SET-03, CA-SUB-15, RF-SET-11, RF-SUB-13
- **Tipo:** automático (Vitest, Prisma real)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/submissions/submission.service.test.ts -t "límite de recepciones"
  ```
- **Resultado esperado:** salida 0 y al menos 3 tests: con `maxSubmissionsPerHour` = 2, las respuestas 1 y 2 se guardan, la 3 lanza `PlanLimitError` y hay 2 filas en `submissions`; el reenvío de la primera con su `clientId` devuelve `created: false` y el contador sigue en 2; si el insert falla, el cupo se devuelve (contador no aumenta).

### PP-SET-07 — Límite de tamaño de archivo

- **Cubre:** CA-SET-04, CA-STO-06, RF-SET-12, RF-STO-12
- **Tipo:** automático (Vitest, Prisma real y adaptador en memoria)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/storage/storage.service.test.ts -t "límite de tamaño"
  ```
- **Resultado esperado:** salida 0 y al menos 3 tests: con `maxFileBytes` = 1 MB, un PNG válido de 2 MB lanza `PayloadTooLargeError` con «tamaño máximo de tu plan» y no hay objeto en el adaptador ni fila en `stored_files`; uno de 500 KB se acepta; uno de exactamente 1 MB se acepta.

### PP-SET-08 — Sin límite

- **Cubre:** CA-SET-05, RF-SET-03, RF-SET-09
- **Tipo:** automático (Vitest, Prisma real)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/admin-settings/usage-limits.service.test.ts src/server/submissions/submission.service.test.ts src/server/storage/storage.service.test.ts -t "sin límite"
  ```
- **Resultado esperado:** salida 0 y al menos 2 tests: con los tres límites nulos, 50 `consumeUsage` seguidos devuelven `allowed: true`, y un archivo del máximo técnico se acepta sin error de plan.

### PP-SET-09 — Aislamiento de contadores

- **Cubre:** CA-SET-06, RF-SET-10
- **Tipo:** automático (Vitest, Prisma real)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/admin-settings/usage-limits.service.test.ts src/server/admin-settings/usage.repository.test.ts -t "aislamiento de contadores"
  ```
- **Resultado esperado:** salida 0 y al menos 2 tests: agotar el cupo de la organización A en un formulario no afecta a la B ni a otro formulario de A; en la hora siguiente (parámetro `now`) el cupo vuelve a estar libre.

### PP-SET-10 — Impresiones: servicio listo

- **Cubre:** CA-SET-08, RF-SET-13
- **Tipo:** automático (Vitest, Prisma real)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/admin-settings/usage-limits.service.test.ts -t "límite de impresiones"
  ```
- **Resultado esperado:** salida 0 y al menos 2 tests: con `maxImpressionsPerHour` = 3, tres `consumeUsage(..., "impression")` devuelven `allowed: true` y la cuarta `allowed: false`; `assertUsage` lanza `PlanLimitError` con `limit === "impressions"`. Además, el fichero `src/app/f/[slug]/` no se ha tocado: `git diff --stat origin/main...HEAD -- "src/app/f"` no muestra nada (si `origin/main` no existe, se usa la rama principal local).

### PP-SET-11 — Concurrencia del contador

- **Cubre:** CA-SET-11, RF-SET-09
- **Tipo:** automático (Vitest, Prisma real)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/admin-settings/usage-limits.service.test.ts -t "concurrencia"
  ```
- **Resultado esperado:** salida 0 y al menos 1 test: 20 `consumeUsage` en paralelo con límite 5 → exactamente 5 `allowed: true`, 15 `allowed: false` y el contador final en base de datos vale 5.

### PP-SET-12 — Migración y plan genérico

- **Cubre:** CA-SET-07, RF-SET-07
- **Tipo:** automático (Vitest, Prisma real) y comando SQL
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/admin-settings/migration.test.ts -t "plan genérico"
  npm run test:stack:run -- npm run db:seed
  ```
- **Resultado esperado:** la primera salida 0 con al menos 2 tests (el plan `plan-generic` existe con 10 000 / 1 000 / 10 485 760; ninguna organización tiene `planId` nulo; el seed ejecutado dos veces no falla ni duplica el plan). El segundo comando (seed repetido sobre una base ya sembrada) termina con código 0.

### PP-SET-13 — Rutas de la demo siguen funcionando

- **Cubre:** CA-SET-07 (la demo sigue funcionando)
- **Tipo:** automático (Playwright)
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx playwright test e2e/platform-smoke.spec.ts e2e/submissions-dashboard-listing.spec.ts e2e/auth-login.spec.ts
  ```
- **Resultado esperado:** salida 0.

## Comprobaciones manuales

- [ ] La pantalla `/admin/settings/plans` es clara en ordenador: tabla legible, nota «Los planes son comunes a todas las organizaciones», mensajes de error en español — Cubre: RNF-SET-02.
- [ ] El enlace «Ajustes» del menú superior queda bien alineado con el resto — Cubre: RF-SET-02.

## Limpieza

```bash
npm run test:stack:down     # en testPR y module-test lo hace el workflow
```

## Historial de cambios

- 2026-11-27 — Plan de pruebas inicial: PP-SET-01 a PP-SET-13 (#40).
- 2026-11-27 — Revisión del arquitecto: PP-SET-04 separa en dos comandos obligatorios el borrado de planes y los tests de `src/lib/admin-settings` (#40).
