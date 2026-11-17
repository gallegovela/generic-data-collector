# <Nombre del módulo> — Plan de pruebas

- **Requisitos:** [README.md](README.md)
- **Diseño:** [design.md](design.md)
- **Responsable:** analyst-programmer (escribe en `design` y lo ejecuta en `testPR`), architect (revisa)
- **Issues:** #<issue de design>

Este plan se ejecuta en la etapa `testPR`, sobre la rama `issue-<n>` de la pull request y **antes de fusionarla**. Cada caso tiene que poder ejecutarlo un agente desde la línea de comandos del runner, sin intervención de una persona: comandos concretos y un resultado esperado comprobable. Lo que solo pueda comprobar una persona (por ejemplo, el aspecto visual) va en "Comprobaciones manuales", que el agente no ejecuta pero lista en su informe.

## Preparación

Pasos comunes antes de los casos, en orden. Ejemplo:

```bash
cp -n .env.example .env
npm ci
docker compose up -d --wait        # solo si algún caso necesita PostgreSQL, MinIO o Mailpit
npm run db:migrate
```

## Comprobaciones generales

Se ejecutan siempre, en este orden, y todas tienen que terminar con código 0:

| ID | Comando |
| --- | --- |
| PP-<MOD>-G1 | `npm run lint` |
| PP-<MOD>-G2 | `npm run typecheck` |
| PP-<MOD>-G3 | `npm test` |
| PP-<MOD>-G4 | `npm run build` |
| PP-<MOD>-G5 | `npm run test:e2e` (solo si el cambio toca el recorrido de la demo) |

## Casos de prueba

Uno o más por cada criterio de aceptación. Los identificadores `PP-<MOD>-NN` no se renumeran nunca; un caso eliminado se marca como `~~retirado~~`.

### PP-<MOD>-01 — <título corto>

- **Cubre:** CA-<MOD>-NN
- **Tipo:** automático (Vitest / Playwright) | comando (curl, script, docker compose)
- **Precondiciones:** <estado necesario además de la preparación>
- **Pasos:**
  ```bash
  npx vitest run src/server/<modulo>/<modulo>.service.test.ts
  ```
- **Resultado esperado:** <código de salida, salida, código HTTP o cuerpo JSON concretos>

## Comprobaciones manuales

Solo lo que un agente no puede verificar. La persona que fusiona la PR las revisa.

- [ ] <comprobación> — Cubre: CA-<MOD>-NN

## Limpieza

```bash
docker compose down -v --remove-orphans   # si se levantó en la preparación
```

## Historial de cambios

- AAAA-MM-DD — Plan de pruebas inicial (#<issue>)
