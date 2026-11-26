# Editor visual de formularios — Plan de pruebas

- **Requisitos:** [README.md](README.md)
- **Diseño:** [design.md](design.md)
- **Responsable:** analyst-programmer (escribe en `design` y lo ejecuta en `testPR`), architect (revisa)
- **Issues:** #6, #34

Este plan se ejecuta en la etapa `testPR`, sobre la rama `issue-6` de la pull request y **antes de fusionarla**. Necesita PostgreSQL (`Form` es una tabla real) pero no MinIO ni Mailpit: este módulo no sube archivos ni envía email.

## Preparación

```bash
cp -n .env.example .env
npm ci
docker compose up -d --wait postgres
npm run db:migrate
npm run db:seed
```

## Comprobaciones generales

| ID | Comando |
| --- | --- |
| PP-EDT-G1 | `npm run lint` |
| PP-EDT-G2 | `npm run typecheck` |
| PP-EDT-G3 | `npm test` |
| PP-EDT-G4 | `npm run build` |
| PP-EDT-G5 | `npm run test:e2e` |

## Casos de prueba

### PP-EDT-01 — Reordenar campos arrastrando persiste tras recargar

- **Cubre:** CA-EDT-01
- **Tipo:** automático (Playwright)
- **Precondiciones:** seed aplicado (usuario admin del seed de `tenancy-auth`); la app arrancada (la cubre `test:e2e`).
- **Pasos:**
  ```bash
  npx playwright test e2e/form-editor-canvas.spec.ts -g "CA-EDT-01"
  ```
- **Resultado esperado:** código de salida 0; todos los tests cuyo título contiene «CA-EDT-01» pasan, sin ninguno fallido ni omitido.

### PP-EDT-02 — Eliminar un campo referenciado por una condición avisa y limpia

- **Cubre:** CA-EDT-02
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna además de la preparación (es lógica pura, sin base de datos).
- **Pasos:**
  ```bash
  npx vitest run src/hooks/use-form-editor-state.test.ts -t "CA-EDT-02"
  ```
- **Resultado esperado:** código de salida 0; todos los tests cuyo título contiene «CA-EDT-02» pasan, sin ninguno fallido ni omitido.

### PP-EDT-03 — Autoguardado 2 s después del último cambio

- **Cubre:** CA-EDT-03
- **Tipo:** automático (Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npx playwright test e2e/form-editor-autosave.spec.ts -g "CA-EDT-03"
  ```
- **Resultado esperado:** código de salida 0; todos los tests cuyo título contiene «CA-EDT-03» pasan, sin ninguno fallido ni omitido.

### PP-EDT-04 — Crear un formulario vacío aparece en el listado

- **Cubre:** CA-EDT-04
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** base de datos migrada.
- **Pasos:**
  ```bash
  npx vitest run src/server/forms/form.service.test.ts -t "CA-EDT-04"
  npx playwright test e2e/form-editor-listing.spec.ts -g "CA-EDT-04"
  ```
- **Resultado esperado:** código de salida 0 en ambos comandos; todos los tests cuyo título contiene «CA-EDT-04» pasan, sin ninguno fallido ni omitido.

### PP-EDT-05 — Duplicar un formulario crea una copia independiente

- **Cubre:** CA-EDT-05
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** base de datos migrada.
- **Pasos:**
  ```bash
  npx vitest run src/server/forms/form.service.test.ts -t "CA-EDT-05"
  npx playwright test e2e/form-editor-listing.spec.ts -g "CA-EDT-05"
  ```
- **Resultado esperado:** código de salida 0 en ambos comandos; todos los tests cuyo título contiene «CA-EDT-05» pasan, sin ninguno fallido ni omitido.

### PP-EDT-06 — Archivar un formulario lo quita del listado por defecto

- **Cubre:** CA-EDT-06
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** base de datos migrada.
- **Pasos:**
  ```bash
  npx vitest run src/server/forms/form.service.test.ts -t "CA-EDT-06"
  npx playwright test e2e/form-editor-listing.spec.ts -g "CA-EDT-06"
  ```
- **Resultado esperado:** código de salida 0 en ambos comandos; todos los tests cuyo título contiene «CA-EDT-06» pasan, sin ninguno fallido ni omitido.

### PP-EDT-07 — Una configuración de campo inválida bloquea el guardado y señala el campo

- **Cubre:** CA-EDT-07
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** ninguna además de la preparación para la parte Vitest; seed aplicado para la parte Playwright.
- **Pasos:**
  ```bash
  npx vitest run src/lib/form-editor/form-editor.schema.test.ts -t "CA-EDT-07"
  npx playwright test e2e/form-editor-autosave.spec.ts -g "CA-EDT-07"
  ```
- **Resultado esperado:** código de salida 0 en ambos comandos; todos los tests cuyo título contiene «CA-EDT-07» pasan, sin ninguno fallido ni omitido.

### PP-EDT-08 — Reordenar con teclado produce el mismo resultado que arrastrando

- **Cubre:** CA-EDT-08
- **Tipo:** automático (Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npx playwright test e2e/form-editor-canvas.spec.ts -g "CA-EDT-08"
  ```
- **Resultado esperado:** código de salida 0; todos los tests cuyo título contiene «CA-EDT-08» pasan, sin ninguno fallido ni omitido.

### PP-EDT-09 — Ninguna consulta de `Form` cruza de organización

- **Cubre:** RNF (aislamiento multi-tenant, regla transversal de `CLAUDE.md`, no tiene `CA-EDT` propio)
- **Tipo:** automático (Vitest)
- **Precondiciones:** base de datos migrada, dos organizaciones de prueba creadas por el propio test.
- **Pasos:**
  ```bash
  npx vitest run src/server/forms/form.repository.test.ts
  ```
- **Resultado esperado:** código de salida 0; incluye un test que comprueba que `archiveForm`/`updateFormName` con el `organizationId` de otra organización devuelven `null` aunque el `id` exista.

### PP-EDT-10 — Añadir un campo desde la paleta (arrastrando y pulsando)

- **Cubre:** CA-EDT-09
- **Tipo:** automático (Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npx playwright test e2e/form-editor-canvas.spec.ts -g "CA-EDT-09"
  ```
- **Resultado esperado:** código de salida 0; todos los tests cuyo título contiene «CA-EDT-09» pasan, sin ninguno fallido ni omitido.

### PP-EDT-11 — Editar las propiedades de un campo persiste tras el autoguardado

- **Cubre:** CA-EDT-10
- **Tipo:** automático (Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npx playwright test e2e/form-editor-autosave.spec.ts -g "CA-EDT-10"
  ```
- **Resultado esperado:** código de salida 0; todos los tests cuyo título contiene «CA-EDT-10» pasan, sin ninguno fallido ni omitido.

### PP-EDT-12 — Eliminar un campo sin referencias y duplicar un campo

- **Cubre:** CA-EDT-11
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna además de la preparación (es lógica pura, sin base de datos).
- **Pasos:**
  ```bash
  npx vitest run src/hooks/use-form-editor-state.test.ts -t "CA-EDT-11"
  ```
- **Resultado esperado:** código de salida 0; todos los tests cuyo título contiene «CA-EDT-11» pasan, sin ninguno fallido ni omitido.

### PP-EDT-13 — Configurar una condición de visibilidad válida y guardarla

- **Cubre:** CA-EDT-12
- **Tipo:** automático (Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npx playwright test e2e/form-editor-autosave.spec.ts -g "CA-EDT-12"
  ```
- **Resultado esperado:** código de salida 0; todos los tests cuyo título contiene «CA-EDT-12» pasan, sin ninguno fallido ni omitido.

### PP-EDT-14 — «Rellenar» lleva a `/f/<slug>` en un formulario publicado

- **Cubre:** CA-EDT-13
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npx vitest run src/lib/form-editor/fill-link.test.ts -t "CA-EDT-13"
  npx playwright test e2e/form-editor-listing.spec.ts -g "CA-EDT-13"
  ```
- **Resultado esperado:** código de salida 0 en ambos comandos; todos los tests cuyo título contiene «CA-EDT-13» pasan, sin ninguno fallido ni omitido.

### PP-EDT-15 — «Rellenar» no está disponible en borrador y se explica

- **Cubre:** CA-EDT-14
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** seed aplicado.
- **Pasos:**
  ```bash
  npx vitest run src/lib/form-editor/fill-link.test.ts -t "CA-EDT-14"
  npx playwright test e2e/form-editor-listing.spec.ts -g "CA-EDT-14"
  ```
- **Resultado esperado:** código de salida 0 en ambos comandos; todos los tests cuyo título contiene «CA-EDT-14» pasan, sin ninguno fallido ni omitido.

### PP-EDT-16 — El listado muestra el recuento real de respuestas, aislado por organización

- **Cubre:** CA-EDT-15
- **Tipo:** automático (Vitest + Playwright)
- **Precondiciones:** base de datos migrada; seed aplicado.
- **Pasos:**
  ```bash
  npx vitest run src/server/forms/form.repository.test.ts -t "CA-EDT-15"
  npx playwright test e2e/form-editor-listing.spec.ts -g "CA-EDT-15"
  ```
- **Resultado esperado:** código de salida 0 en ambos comandos; todos los tests cuyo título contiene «CA-EDT-15» pasan, sin ninguno fallido ni omitido.

## Pruebas globales del módulo

Todavía no aplica: solo hay un issue (#6) en `form-editor`. Se añadirá cuando el arquitecto pida una prueba global en la etapa `merge`.

## Comprobaciones manuales

- [ ] El lienzo, la paleta y el panel de propiedades tienen buen aspecto visual y son usables en un portátil de 13" y en una tablet (RNF-EDT-01) — Cubre: RNF-EDT-01.
- [ ] La vista previa móvil se parece de verdad a un teléfono y usa los colores de `DEFAULT_THEME` (RF-EDT-09) — Cubre: RF-EDT-09.
- [ ] El botón "Pedir cambios a la IA" está visible pero deshabilitado, con un texto o tooltip que explique que llegará más adelante (RF-EDT-12, placeholder) — Cubre: RF-EDT-12.
- [ ] Con un formulario de ~100 campos, arrastrar y escribir en el panel de propiedades no se nota con tirones perceptibles (RNF-EDT-02, Should) — Cubre: RNF-EDT-02.
- [ ] El menú de la fila muestra «Rellenar» desactivada con su explicación de forma clara y el enlace del contador de respuestas se ve como enlace (RF-EDT-13, RF-EDT-14) — Cubre: RF-EDT-13, RF-EDT-14.

## Limpieza

```bash
docker compose down -v --remove-orphans
```

## Historial de cambios

- 2026-11-17 — Plan de pruebas inicial (#6): PP-EDT-01 a PP-EDT-09, uno por cada CA-EDT-01 a CA-EDT-08 más el aislamiento multi-tenant transversal.
- 2026-11-26 — #34: PP-EDT-14 a PP-EDT-16 para CA-EDT-13 a CA-EDT-15 (acción «Rellenar» y contador real). Comprobación manual añadida.
- 2026-11-17 — Revisión del arquitecto (#6): PP-EDT-10 a PP-EDT-13, uno por cada CA-EDT-09 a CA-EDT-12 (RF-EDT-03, 05, 06 y 07, que no tenían ningún caso trazable).
