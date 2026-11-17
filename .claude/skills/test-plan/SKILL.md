---
name: test-plan
description: Cómo escribir y ejecutar el plan de pruebas de un módulo de FormIA (specs/<modulo>/test-plan.md) - casos PP-<MOD>-NN ligados a los criterios de aceptación, ejecutables por un agente desde la línea de comandos antes de fusionar la PR, y cómo informar del resultado en la etapa testPR. Úsala al crear o actualizar un test-plan.md en la etapa "design" y al ejecutarlo en la etapa "testPR" (etiqueta pr-raised).
---

# Plan de pruebas (`specs/<modulo>/test-plan.md`)

El plan de pruebas dice **cómo se comprueba, antes de fusionar la PR, que la rama cumple los criterios de aceptación**. Lo escribe el analista programador en la etapa `design` y lo ejecuta él mismo en la etapa `testPR`, sobre la rama `issue-<n>` de la PR, en el runner de GitHub Actions.

## Al escribirlo (etapa `design`)

1. Si el módulo no tiene `test-plan.md`, cópialo de `specs/_template/test-plan.md`. Si ya existe, actualízalo: el plan es del módulo y crece con cada issue.
2. Para cada criterio de aceptación que añade o cambia el issue, escribe al menos un caso `PP-<MOD>-NN`. Los números no se reutilizan ni se renumeran; un caso que ya no aplica se tacha: `~~PP-FSC-04~~ (retirado: sustituido por PP-FSC-09)`.
3. Cada caso indica: **Cubre** (`CA-<MOD>-NN`), **Tipo**, **Precondiciones**, **Pasos** (comandos exactos) y **Resultado esperado** comprobable (código de salida, texto de la salida, código HTTP, campos del JSON).
4. Prefiere los tests automáticos que el plan de acción ya pide al programador (`npx vitest run <fichero>`, `npx playwright test <fichero>`). Añade casos con `curl` o `docker compose` solo para lo que no cubren (por ejemplo, un endpoint con la app arrancada o la configuración de producción).
5. Mantén la **Preparación** y la **Limpieza** al día: qué servicios hacen falta (`docker compose up -d --wait`), migraciones, seed, cómo arrancar la app (`npm run build && npm start &`) y cómo pararlo todo.
6. Lo que solo puede comprobar una persona (aspecto visual, uso real en el móvil) va en **Comprobaciones manuales**. El agente no lo ejecuta; lo deja listado para quien fusiona.
7. Anota el cambio en el historial del fichero citando el issue.

### Qué puede ejecutar el agente en `testPR`

Solo dispone de: lectura de ficheros, `git` de lectura, `npm ci`, `npm install`, `npm run …`, `npm test`, `npx …`, `docker compose …`, `curl` y `gh` de lectura. No puede editar ficheros ni hacer commits. Escribe los pasos con esos comandos, uno por línea, sin tuberías ni scripts temporales.

Otras restricciones del runner:

- Los servicios de `docker-compose.yml` se levantan con un nombre de proyecto aislado (`COMPOSE_PROJECT_NAME=formia-testpr-<n>`), así que no chocan con la demo desplegada.
- `.env` se crea copiando `.env.example` antes de empezar: no hay secretos reales. Un caso que necesite una API externa real (Anthropic, SMTP real) no se puede ejecutar; usa mocks en los tests o pásalo a comprobaciones manuales.

## Al ejecutarlo (etapa `testPR`)

1. Ejecuta, en este orden: Preparación → Comprobaciones generales → casos `PP-<MOD>-NN` del issue → Limpieza (siempre, aunque algo falle).
2. Ejecuta los pasos **tal como están escritos**. No los adaptes ni "arregles" el código o el plan: tu papel es comprobar.
3. Resultado de cada caso: ✅ superado, ❌ fallido (pega la parte relevante de la salida, sin secretos ni datos personales) o ⏭️ no ejecutado (con el motivo).
4. Resultado global:
   - `SUPERADO`: todas las comprobaciones generales y todos los casos del issue superados.
   - `FALLIDO`: al menos uno falla por el código de la PR. Explica el fallo para el programador.
   - `BLOQUEADO`: el plan falta, es contradictorio o no se puede ejecutar en el runner. Explícalo para el analista y el arquitecto.

   No cambies etiquetas: el workflow pone `merge` si el resultado es `SUPERADO` y `human-review` en cualquier otro caso. Un issue en `human-review` bloquea la fusión de todo su módulo hasta que una persona lo revise.
5. Publica el informe con la plantilla "resultado del plan de pruebas" de la skill `github-issues`. El workflow lo pone en la conversación de la PR.
