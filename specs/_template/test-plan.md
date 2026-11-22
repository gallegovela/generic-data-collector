# <Nombre del módulo> — Plan de pruebas

- **Requisitos:** [README.md](README.md)
- **Diseño:** [design.md](design.md)
- **Responsable:** analyst-programmer (escribe en `design` y lo ejecuta en `testPR`), architect (revisa)
- **Issues:** #<issue de design>

Este plan se ejecuta en la etapa `testPR`, sobre la rama `issue-<n>` de la pull request (con la última rama principal fusionada) y **antes de fusionarla**. Todo se ejecuta en el entorno de pruebas en contenedores (ver "Pruebas en contenedores" en `specs/platform/design.md`): cada comando va dentro del contenedor `tests` con `npm run test:stack:run -- <comando>`, y los servicios se llaman por su nombre (`web`, `postgres`, `minio`, `mailpit`), nunca `localhost`. Cada caso tiene que poder ejecutarlo un agente sin intervención de una persona: comandos concretos y un resultado esperado comprobable. Lo que solo pueda comprobar una persona (por ejemplo, el aspecto visual) va en "Comprobaciones manuales", que el agente no ejecuta pero lista en su informe.

## Preparación

Pasos comunes antes de los casos, en orden. El primero siempre es levantar el entorno (en `testPR` y `module-test` ya lo hace el workflow). Ejemplo:

```bash
npm run test:stack:up                            # imágenes de la rama, servicios, bucket, migraciones y app
npm run test:stack:run -- npm run db:seed        # solo si algún caso necesita los datos de ejemplo
```

## Comprobaciones generales

Se ejecutan siempre, en este orden, y todas tienen que terminar con código 0:

| ID | Comando |
| --- | --- |
| PP-<MOD>-G1 | `npm run test:stack:run -- npm run lint` |
| PP-<MOD>-G2 | `npm run test:stack:run -- npm run typecheck` |
| PP-<MOD>-G3 | `npm run test:stack:run -- npm test` |
| PP-<MOD>-G4 | `npm run test:stack:run -- npm run build` |
| PP-<MOD>-G5 | `npm run test:stack:run -- npx playwright test` (solo si el cambio toca el recorrido de la demo) |

## Casos de prueba

Uno o más por cada criterio de aceptación. Los identificadores `PP-<MOD>-NN` no se renumeran nunca; un caso eliminado se marca como `~~retirado~~`.

### PP-<MOD>-01 — <título corto>

- **Cubre:** CA-<MOD>-NN
- **Tipo:** automático (Vitest / Playwright) | comando (curl contra `http://web:3000`, script)
- **Precondiciones:** <estado necesario además de la preparación>
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx vitest run src/server/<modulo>/<modulo>.service.test.ts
  ```
- **Resultado esperado:** <código de salida, salida, código HTTP o cuerpo JSON concretos>

## Pruebas globales del módulo

Solo existe si el arquitecto pide una prueba global en la etapa `merge`. La escribe y la ejecuta el analista en la etapa `module-test`, sobre la rama de integración (rama principal + todas las PRs abiertas del módulo). Cada caso prueba un escenario que cruza varias PRs.

### PP-<MOD>-M1 — <escenario>

- **Pide:** #<issue integration>
- **PRs implicadas:** #<pr>, #<pr>
- **Pasos:**
  ```bash
  npm run test:stack:run -- npx playwright test e2e/<modulo>-global.spec.ts
  ```
- **Resultado esperado:** <comprobable>

## Comprobaciones manuales

Solo lo que un agente no puede verificar. La persona que fusiona la PR las revisa.

- [ ] <comprobación> — Cubre: CA-<MOD>-NN

## Limpieza

```bash
npm run test:stack:down     # en testPR y module-test lo hace el workflow
```

## Historial de cambios

- AAAA-MM-DD — Plan de pruebas inicial (#<issue>)
