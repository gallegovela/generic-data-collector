# Esquema del formulario — Plan de pruebas

- **Requisitos:** [README.md](README.md)
- **Diseño:** [design.md](design.md)
- **Responsable:** analyst-programmer (escribe en `design` y lo ejecuta en `testPR`), architect (revisa)
- **Issues:** #5

Este plan se ejecuta en la etapa `testPR`, sobre la rama `issue-5` de la pull request y **antes de fusionarla**. `form-schema` es una librería pura (RNF-FSC-01): no necesita PostgreSQL, MinIO ni Mailpit, así que no hay que levantar `docker compose` para ninguno de sus casos.

## Preparación

```bash
cp -n .env.example .env
npm ci
```

## Comprobaciones generales

Se ejecutan siempre, en este orden, y todas tienen que terminar con código 0:

| ID | Comando |
| --- | --- |
| PP-FSC-G1 | `npm run lint` |
| PP-FSC-G2 | `npm run typecheck` |
| PP-FSC-G3 | `npm test` |
| PP-FSC-G4 | `npm run build` |
| PP-FSC-G5 | `npm run test:e2e` — no aplica: este issue no toca el recorrido de la demo (sin interfaz todavía). |

## Casos de prueba

### PP-FSC-01 — Rechaza ids de campo duplicados

- **Cubre:** CA-FSC-01
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna además de la preparación.
- **Pasos:**
  ```bash
  npx vitest run src/lib/form-schema/form-version.schema.test.ts -t "CA-FSC-01"
  ```
- **Resultado esperado:** código de salida 0; la salida indica `1 passed` (ningún test omitido).

### PP-FSC-02 — Campo obligatorio oculto no bloquea el envío

- **Cubre:** CA-FSC-02
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna además de la preparación.
- **Pasos:**
  ```bash
  npx vitest run src/lib/form-schema/submission.test.ts -t "CA-FSC-02"
  ```
- **Resultado esperado:** código de salida 0; la salida indica `1 passed`.

### PP-FSC-03 — Límite numérico rechazado

- **Cubre:** CA-FSC-03
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna además de la preparación.
- **Pasos:**
  ```bash
  npx vitest run src/lib/form-schema/submission.test.ts -t "CA-FSC-03"
  ```
- **Resultado esperado:** código de salida 0; la salida indica `1 passed`.

### PP-FSC-04 — Los tres formularios de ejemplo son válidos

- **Cubre:** CA-FSC-04
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna además de la preparación.
- **Pasos:**
  ```bash
  npx vitest run src/lib/form-schema/fixtures/demo-forms.test.ts -t "CA-FSC-04"
  ```
- **Resultado esperado:** código de salida 0; la salida indica `1 passed` (los tres `FormVersion` de `fixtures/demo-forms.ts` validan sin error).

### PP-FSC-05 — Referencia de condición inexistente, posterior o circular rechazada

- **Cubre:** CA-FSC-05
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna además de la preparación.
- **Pasos:**
  ```bash
  npx vitest run src/lib/form-schema/form-version.schema.test.ts -t "CA-FSC-05"
  ```
- **Resultado esperado:** código de salida 0; la salida indica `1 passed`.

### PP-FSC-06 — Operador "includes" evalúa la visibilidad de un campo `multiple_choice`

- **Cubre:** CA-FSC-06
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna además de la preparación.
- **Pasos:**
  ```bash
  npx vitest run src/lib/form-schema/condition.schema.test.ts -t "CA-FSC-06"
  ```
- **Resultado esperado:** código de salida 0; la salida indica `1 passed`.

### PP-FSC-07 — Operador "isAnswered" evalúa la visibilidad

- **Cubre:** CA-FSC-07
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna además de la preparación.
- **Pasos:**
  ```bash
  npx vitest run src/lib/form-schema/condition.schema.test.ts -t "CA-FSC-07"
  ```
- **Resultado esperado:** código de salida 0; la salida indica `1 passed`.

### PP-FSC-08 — Id de opción estable tras renombrar la etiqueta

- **Cubre:** CA-FSC-08
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna además de la preparación.
- **Pasos:**
  ```bash
  npx vitest run src/lib/form-schema/field.schema.test.ts -t "CA-FSC-08"
  ```
- **Resultado esperado:** código de salida 0; la salida indica `1 passed`.

## Pruebas globales del módulo

Todavía no existe: solo hay un issue de desarrollo en este módulo (#5). Se añadirá cuando el arquitecto pida una prueba global en la etapa `merge`.

## Comprobaciones manuales

- [ ] Cobertura de líneas de `src/lib/form-schema` ≥ 90 % (RNF-FSC-02). Pendiente de que el arquitecto confirme si se automatiza con `@vitest/coverage-v8` (ver pregunta en el issue #5); mientras no se automatice, revisar el informe de cobertura a mano.

## Limpieza

Ninguna: este módulo no levanta ningún servicio (no hay `docker compose` que parar).

## Historial de cambios

- 2026-11-17 — Plan de pruebas inicial: PP-FSC-01 a PP-FSC-08 (#5).
