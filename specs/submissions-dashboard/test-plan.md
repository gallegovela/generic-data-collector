# Respuestas y panel — Plan de pruebas

- **Requisitos:** [README.md](README.md)
- **Diseño:** [design.md](design.md)
- **Responsable:** analyst-programmer (escribe en `design` y lo ejecuta en `testPR`), architect (revisa)
- **Issues:** #7 (diseño)

Este plan se ejecuta en la etapa `testPR`, sobre la rama `issue-7` de la pull request y **antes de fusionarla**. Cubre solo el alcance de #7 (listado, ficha de detalle y panel de inicio, en modo solo lectura, con datos de prueba creados por los propios tests): no cubre CA-SUB-01 (idempotencia de la recepción), que queda para cuando se diseñe la recepción real.

## Preparación

```bash
cp -n .env.example .env
npm ci
docker compose up -d --wait
npm run db:migrate
```

## Comprobaciones generales

| ID | Comando |
| --- | --- |
| PP-SUB-G1 | `npm run lint` |
| PP-SUB-G2 | `npm run typecheck` |
| PP-SUB-G3 | `npm test` |
| PP-SUB-G4 | `npm run build` |
| PP-SUB-G5 | `npm run test:e2e` |

## Casos de prueba

### PP-SUB-01 — Aislamiento por organización (listado, ficha, campos filtrables, estadísticas y búsqueda de texto)

- **Cubre:** RNF-SUB-03 (filtro por `organizationId` en las cuatro funciones de lectura del repositorio, alcance general del módulo)
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna (el test crea sus propias dos organizaciones, A y B, con el **mismo** `formId` en ambas —para forzar el cruce si el filtro fallara— y al menos una respuesta de A con GPS/`yes_no` y una palabra de texto libre que no existe en B).
- **Pasos:**
  ```bash
  npx vitest run src/server/submissions/submission.repository.test.ts -t "organizacion"
  ```
- **Resultado esperado:** código de salida 0; consultando siempre con el `organizationId` de B pero con el `id`/`formId`/texto de A:
  - `findSubmissionById(orgB, idDeA)` devuelve `null`.
  - `listSubmissionsByForm(orgB, formIdDeA, {...})` devuelve `{ items: [], total: 0 }`.
  - `findFilterableFields(orgB, formIdDeA)` devuelve `[]` (no los campos del `formVersionSnapshot` de A).
  - `getSubmissionStats(orgB)` devuelve `{ today: 0, thisWeek: 0, byForm: [] }` aunque A tenga respuestas de hoy y de esta semana.
  - buscar con `textQuery` una palabra que solo existe en una respuesta de A, con `organizationId` de B, no devuelve ningún `id` (`findSubmissionIdsByText`) ni ninguna fila en `listSubmissionsByForm` con ese filtro de texto.

### PP-SUB-02 — Copia inmutable del esquema en cada respuesta

- **Cubre:** RF-SUB-11
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npx vitest run src/server/submissions/submission.repository.test.ts -t "formVersionSnapshot"
  ```
- **Resultado esperado:** código de salida 0; `createSubmissionFixture` guarda `formVersionSnapshot` byte a byte igual al que se le pasó; una `Submission` creada con un `FormVersion` de ejemplo y luego "modificado" en memoria no cambia lo que hay en base de datos.

### PP-SUB-03 — Paginación del listado (20 por página)

- **Cubre:** CA-SUB-04, RF-SUB-05
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna (el test crea 25 `Submission` de un mismo `formId`).
- **Pasos:**
  ```bash
  npx vitest run src/server/submissions/submission.repository.test.ts -t "CA-SUB-04"
  ```
- **Resultado esperado:** código de salida 0; página 1 devuelve 20 elementos y `total: 25`; página 2 devuelve los 5 restantes; el orden es de `capturedAt` más reciente a más antigua.

### PP-SUB-04 — Filtro por campo sí/no

- **Cubre:** CA-SUB-02, RF-SUB-06
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna (el test usa la *fixture* con el campo `yes_no` "¿Hay incidencias?").
- **Pasos:**
  ```bash
  npx vitest run src/server/submissions/submission.service.test.ts -t "CA-SUB-02"
  ```
- **Resultado esperado:** código de salida 0; con `fieldId` del campo "¿Hay incidencias?" y `fieldValue: "true"`, solo se devuelven las respuestas con esa respuesta en `true`; con `fieldValue: "false"`, solo las que la tienen en `false`.

### PP-SUB-05 — Filtro combinado de fechas y usuario

- **Cubre:** CA-SUB-08, RF-SUB-06
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npx vitest run src/server/submissions/submission.service.test.ts -t "CA-SUB-08"
  ```
- **Resultado esperado:** código de salida 0; con `dateFrom`/`dateTo` y `submittedBy` aplicados juntos, solo aparecen las respuestas que cumplen ambos a la vez (se comprueba con respuestas que cumplen solo uno de los dos y no deben salir).

### PP-SUB-06 — Búsqueda de texto libre

- **Cubre:** CA-SUB-05, RF-SUB-07
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npx vitest run src/server/submissions/submission.repository.test.ts -t "CA-SUB-05"
  ```
- **Resultado esperado:** código de salida 0; buscar una palabra presente en un campo de texto de una sola respuesta (en mayúsculas distintas a como se guardó) devuelve solo esa respuesta; buscar una palabra que no aparece en ninguna devuelve `{ items: [], total: 0 }`.

### PP-SUB-07 — Estadísticas del panel de inicio

- **Cubre:** CA-SUB-06, RF-SUB-10
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna (el test crea respuestas de hoy, de otro día de esta semana y de la semana pasada, en dos formularios distintos).
- **Pasos:**
  ```bash
  npx vitest run src/server/submissions/submission.repository.test.ts -t "CA-SUB-06"
  ```
- **Resultado esperado:** código de salida 0; `today` cuenta solo las de hoy, `thisWeek` las de esta semana (incluidas las de hoy) y `byForm` desglosa por `formId` con el `count` correcto; las de la semana pasada no se cuentan en ninguno de los dos totales.

### PP-SUB-08 — Renderizado de cada tipo de campo en la ficha

- **Cubre:** RF-SUB-08 (parte de representación, sin mapa ni fotos/firma, que cubren PP-SUB-09 y PP-SUB-10)
- **Tipo:** automático (Vitest)
- **Precondiciones:** ninguna.
- **Pasos:**
  ```bash
  npx vitest run src/lib/submissions-dashboard/field-display.test.ts
  ```
- **Resultado esperado:** código de salida 0; un caso por cada `FieldType` de la *fixture* (texto, `yes_no`, `photo`, `signature`, `gps`, `section`) con el `kind` y el contenido esperados; un campo opcional sin responder devuelve `{ kind: "empty" }`.

### PP-SUB-09 — Ficha de detalle: mapa GPS

- **Cubre:** CA-SUB-03
- **Tipo:** automático (Playwright)
- **Precondiciones:** `npm run build` previo o `webServer` de Playwright; la propia prueba crea la organización, el admin y la `Submission` con un campo `gps` respondido en un `beforeAll` (llamando directamente a `submissionRepository.createSubmissionFixture`, sin depender de ningún seed global).
- **Pasos:**
  ```bash
  npx playwright test e2e/submissions-dashboard-detail.spec.ts -g "CA-SUB-03"
  ```
- **Resultado esperado:** código de salida 0; la ficha de esa respuesta muestra el contenedor `[data-testid="submission-map"]` con un marcador en la posición guardada.

### PP-SUB-10 — Ficha de detalle: fotos, firma y solo lectura

- **Cubre:** CA-SUB-09, CA-SUB-07
- **Tipo:** automático (Playwright)
- **Precondiciones:** igual que PP-SUB-09, con una `Submission` que tenga `photo` (al menos 2 fotos) y `signature` respondidos.
- **Pasos:**
  ```bash
  npx playwright test e2e/submissions-dashboard-detail.spec.ts -g "CA-SUB-09|CA-SUB-07"
  ```
- **Resultado esperado:** código de salida 0; se ven dos miniaturas de foto y una imagen de firma; pulsar una miniatura abre la imagen a tamaño completo (nueva pestaña o superposición); la página no contiene ningún campo editable, botón "Guardar" ni botón "Editar".

### PP-SUB-11 — Recorrido del listado: filtro, paginación y apertura de una ficha

- **Cubre:** CA-SUB-04, CA-SUB-02
- **Tipo:** automático (Playwright)
- **Precondiciones:** igual que PP-SUB-09, con 21 `Submission` del mismo `formId` creadas en el `beforeAll` (al menos una con "¿Hay incidencias?" en `true`).
- **Pasos:**
  ```bash
  npx playwright test e2e/submissions-dashboard-listing.spec.ts
  ```
- **Resultado esperado:** código de salida 0; el listado muestra 20 filas y un control de página 2 con la restante; al aplicar el filtro "¿Hay incidencias? = Sí" solo quedan las filas con ese valor; al pulsar una fila se abre su ficha de detalle (URL `/admin/forms/<formId>/submissions/<id>`).

### PP-SUB-12 — Panel de inicio con contadores

- **Cubre:** CA-SUB-06
- **Tipo:** automático (Playwright)
- **Precondiciones:** igual que PP-SUB-07, pero creando los datos vía Prisma directamente en el `beforeAll` del propio test (no por la interfaz).
- **Pasos:**
  ```bash
  npx playwright test e2e/submissions-dashboard-home.spec.ts
  ```
- **Resultado esperado:** código de salida 0; `/admin` muestra el número de respuestas de hoy, de esta semana y el desglose por formulario coincidiendo con los datos creados.

## Comprobaciones manuales

- [ ] El mapa, las miniaturas de fotos y la firma se ven bien en móvil (360 px) y en escritorio — Cubre: RF-SUB-08, CLAUDE.md "móvil primero".
- [ ] El marcador de posición de fotos/firma (`placeholder-photo.svg`, `placeholder-signature.svg`) tiene un aspecto aceptable para una demo (no se ve como un error) — Cubre: RF-SUB-08, hasta que exista `file-storage`.
- [ ] Rendimiento del listado con 10 000 respuestas por formulario (RNF-SUB-02): no se comprueba en este plan por falta de datos a esa escala en el runner; pendiente de un test de carga específico cuando exista `demo-seed` — Cubre: RNF-SUB-02 (riesgo anotado, ver `design.md`).

## Limpieza

```bash
docker compose down -v --remove-orphans
```

## Historial de cambios

- 2026-11-18 — Plan de pruebas inicial (#7): PP-SUB-01 a PP-SUB-12 para el aislamiento por organización, la copia inmutable del esquema (RF-SUB-11), la paginación (CA-SUB-04), los filtros (CA-SUB-02, CA-SUB-08), la búsqueda de texto libre (CA-SUB-05), las estadísticas del panel de inicio (CA-SUB-06), el renderizado por tipo de campo, el mapa GPS (CA-SUB-03), fotos/firma y el carácter de solo lectura (CA-SUB-09, CA-SUB-07). RNF-SUB-02 y el aspecto visual quedan en comprobaciones manuales. CA-SUB-01 queda fuera (recepción real, no cubierta por #7).
- 2026-11-18 — Revisión del arquitecto (#7, cambio bloqueante): PP-SUB-01 ampliado para que el aislamiento por `organizationId` cubra también `findFilterableFields`, `getSubmissionStats` y la búsqueda de texto (`findSubmissionIdsByText`), no solo `findSubmissionById`/`listSubmissionsByForm`.
