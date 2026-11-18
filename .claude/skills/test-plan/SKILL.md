---
name: test-plan
description: Cómo escribir y ejecutar el plan de pruebas de un módulo de FormIA (specs/<modulo>/test-plan.md) - casos PP-<MOD>-NN ligados a los criterios de aceptación, ejecutables por un agente desde la línea de comandos antes de fusionar la PR, casos globales PP-<MOD>-M<N> que prueban juntas todas las PRs del módulo, y cómo informar del resultado en las etapas testPR y module-test. Úsala al crear o actualizar un test-plan.md en la etapa "design", al ejecutarlo en la etapa "testPR" (etiqueta pr-raised) y al escribir y ejecutar las pruebas globales en la etapa "module-test".
---

# Plan de pruebas (`specs/<modulo>/test-plan.md`)

El plan de pruebas dice **cómo se comprueba, antes de fusionar la PR, que la rama cumple los criterios de aceptación**. Lo escribe el analista programador en la etapa `design` y lo ejecuta él mismo en la etapa `testPR`, sobre la rama `issue-<n>` de la PR, en el runner de GitHub Actions.

## Al escribirlo (etapa `design`)

1. Si el módulo no tiene `test-plan.md`, cópialo de `specs/_template/test-plan.md`. Si ya existe, actualízalo: el plan es del módulo y crece con cada issue.
2. Para cada criterio de aceptación que añade o cambia el issue, escribe al menos un caso `PP-<MOD>-NN`. Los números no se reutilizan ni se renumeran; un caso que ya no aplica se tacha: `~~PP-FSC-04~~ (retirado: sustituido por PP-FSC-09)`.
3. Cada caso indica: **Cubre** (`CA-<MOD>-NN`), **Tipo**, **Precondiciones**, **Pasos** (comandos exactos) y **Resultado esperado** comprobable (código de salida, texto de la salida, código HTTP, campos del JSON).
4. Prefiere los tests automáticos que el plan de acción ya pide al programador (`npm run test:stack:run -- npx vitest run <fichero>`, `npm run test:stack:run -- npx playwright test <fichero>`). Añade casos con `curl` solo para lo que no cubren, contra la app ya arrancada: `npm run test:stack:run -- curl -fsS http://web:3000/...`.
5. Mantén la **Preparación** y la **Limpieza** al día. La preparación empieza siempre con `npm run test:stack:up`, que ya construye la rama, levanta PostgreSQL, MinIO y Mailpit, crea el bucket, migra y arranca la app; añade solo lo específico (por ejemplo, el seed). Si el módulo añade a `.env.example` una variable que apunta a `localhost`, añádela también en `docker-compose.test.yml` con el nombre del servicio.
6. Lo que solo puede comprobar una persona (aspecto visual, uso real en el móvil) va en **Comprobaciones manuales**. El agente no lo ejecuta; lo deja listado para quien fusiona.
7. Anota el cambio en el historial del fichero citando el issue.

### Qué puede ejecutar el agente en `testPR`

Todo se ejecuta en el entorno de pruebas en contenedores (ver "Pruebas en contenedores" en `specs/platform/design.md`). El agente solo dispone de: lectura de ficheros, `git` de lectura, `npm run test:stack:run -- <comando>` (cualquier comando dentro del contenedor `tests`), `npm run test:stack:logs -- <servicio>` y `gh` de lectura. No puede editar ficheros, hacer commits, ni ejecutar nada directamente en el runner. Escribe cada paso como un comando `npm run test:stack:run -- ...`, uno por línea, sin tuberías ni scripts temporales.

Otras restricciones del entorno:

- Dentro de `tests`, los servicios se llaman por su nombre: `web:3000`, `postgres:5432`, `minio:9000`, `mailpit:1025` (SMTP) y `mailpit:8025` (API de Mailpit para comprobar emails). Nunca `localhost`.
- Antes de las pruebas, el workflow fusiona la última rama principal en la rama de la PR (sin subirla) y levanta el entorno; al final lo borra. Cada PR tiene su propio entorno (`COMPOSE_PROJECT_NAME=formia-testpr-<n>`), aislado de las demás y de la demo desplegada.
- Las variables salen de `.env.example`: no hay secretos reales. Un caso que necesite una API externa real (Anthropic, SMTP real) no se puede ejecutar; usa mocks en los tests o pásalo a comprobaciones manuales.

## Al ejecutarlo (etapa `testPR`)

1. Ejecuta, en este orden: Preparación (salvo `npm run test:stack:up`, que ya hizo el workflow) → Comprobaciones generales → casos `PP-<MOD>-NN` del issue. La limpieza la hace el workflow.
2. Ejecuta los pasos **tal como están escritos**. No los adaptes ni "arregles" el código o el plan: tu papel es comprobar.
3. Resultado de cada caso: ✅ superado, ❌ fallido (pega la parte relevante de la salida, sin secretos ni datos personales) o ⏭️ no ejecutado (con el motivo).
4. Resultado global:
   - `SUPERADO`: todas las comprobaciones generales y todos los casos del issue superados.
   - `FALLIDO`: al menos uno falla por el código de la PR. Explica el fallo para el programador.
   - `BLOQUEADO`: el plan falta, es contradictorio o no se puede ejecutar en el runner. Explícalo para el analista y el arquitecto.

   No cambies etiquetas: el workflow pone `merge` si el resultado es `SUPERADO` y `human-review` en cualquier otro caso. Un issue en `human-review` bloquea la fusión de todo su módulo hasta que una persona lo revise.
5. Publica el informe con la plantilla "resultado del plan de pruebas" de la skill `github-issues`. El workflow lo pone en la conversación de la PR.

## Pruebas globales del módulo (etapa `module-test`)

Las pide el arquitecto en la etapa `merge` cuando las piezas de un módulo tienen que probarse juntas. Se trabaja sobre un issue `integration` y la rama `issue-<m>`, que el workflow construye con la rama principal más todas las PRs abiertas del módulo.

1. Escribe o actualiza la sección **"Pruebas globales del módulo"** de `specs/<modulo>/test-plan.md` con lo que pide el arquitecto en el issue. Casos `PP-<MOD>-M<N>`, con el mismo formato que los demás, pero cada uno prueba un escenario que **cruza varias PRs** (no repitas lo que ya prueba cada PR por separado). Los números no se reutilizan.
2. Haz commit en `issue-<m>` (sin push). La PR de integración lleva ese plan a la rama principal; el arquitecto la fusiona la última.
3. Ejecuta: Preparación (salvo `npm run test:stack:up`, que ya hizo el workflow) → Comprobaciones generales → casos `PP-<MOD>-M<N>`. La limpieza la hace el workflow.
4. No corriges código. Si algo falla, indica qué PR o issue lo provoca: el arquitecto decide a quién se le pone `human-review`.
5. Publica el informe con la plantilla "resultado de la prueba global del módulo" de la skill `github-issues`. El workflow lo pone en el issue `integration` y devuelve el control al arquitecto.
