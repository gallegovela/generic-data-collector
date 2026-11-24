---
name: github-issues
description: Cómo leer, crear, enlazar y comentar issues y pull requests de GitHub en FormIA con la CLI gh - etiquetas de etapa (analysis, design, develop, pr-raised, merge, module-test), de estado (needs-info, human-review, module-test-done) y de tipo (integration), plantillas del issue de diseño, del borrador y la revisión, del plan de acción para el desarrollador, de la PR, del resultado del plan de pruebas, de la etapa merge, del issue de prueba global y de su resultado, y reglas de comunicación entre agentes. Úsala siempre que leas o escribas en un issue o PR.
---

# Issues y pull requests de GitHub

## Comandos básicos (`gh`)

```bash
node $RUNNER_TEMP/issue-thread.mjs <n>            # leer issue o PR e hilo (en el pipeline)
node .github/scripts/issue-thread.mjs <n>         # lo mismo fuera del pipeline
gh issue list --state all --search "Padre: #<n> in:body"   # hijos de un issue
gh issue create --title '<t>' --body-file <fichero> --label "module:<modulo>"
gh issue edit <n> --body-file <fichero>           # actualizar la lista de tareas del padre
gh issue edit <n> --add-label needs-info           # bloquear esperando respuesta
gh issue edit <n> --remove-label needs-info
gh label create "module:<modulo>" --color 0e8a16 --description "<d>"   # si no existe
gh pr list --head issue-<n>                        # ¿ya hay PR?
gh pr create --base main --head issue-<n> --title '<t>' --body '<cuerpo>'
gh issue edit <n> --remove-label develop --add-label pr-raised   # el developer, al abrir la PR
node $RUNNER_TEMP/issue-thread.mjs <pr>           # leer la PR (etapas testPR y merge)
gh pr view <pr> --json mergeable,mergeStateStatus   # ¿se puede fusionar? (etapa merge)
gh pr review <pr> --approve --body "<motivo>"       # solo el architect, en la etapa merge
gh pr merge <pr> --merge                           # solo el architect, en la etapa merge
```

En el pipeline de GitHub Actions, el cuerpo de un issue nunca se pasa en línea con `--body`: la comprobación de permisos rechaza cualquier comando de varias líneas con una línea que empiece por `#` (todos los títulos Markdown), y también las tuberías, los heredocs y la sustitución de comandos. Escribe el cuerpo con la herramienta Write en `$RUNNER_TEMP/bodies/<nombre>.md` (el único sitio donde se permite escribir) y pásalo con `--body-file` en un comando de una sola línea. El título va entre comillas simples; si necesita un apóstrofo, usa ’. La respuesta final del agente la publica el propio workflow como comentario; el agente no tiene que comentar a mano.

## Etiquetas

| Etiqueta | Uso | La pone |
| --- | --- | --- |
| `analysis` | Etapa 1: la procesa el **architect** | Una persona |
| `design` | Etapa 2: la procesa el **analyst-programmer**, revisado por el architect | El architect, al crear el issue hijo |
| `develop` | Etapa 3: la procesa el **developer** | El analyst-programmer, al publicar el plan de acción final (cambia `design` por `develop`) |
| `pr-raised` | Etapa 4, `testPR`: la procesa el **analyst-programmer**, que ejecuta el plan de pruebas sobre la PR | El **developer**, al abrir la PR (quitando `develop`); o una persona, para repetir las pruebas |
| `merge` | Etapa 5: la procesa el **architect** cuando **todos** los issues abiertos del módulo están listos: pide una prueba global o aprueba y fusiona todas sus PRs en un solo paso | El workflow, cuando `testPR` da `SUPERADO`; o una persona, para dar una PR por buena |
| `module-test` | Etapa 6, en un issue `integration`: la procesa el **analyst-programmer**, que prueba juntas todas las PRs del módulo | El workflow, cuando el architect pide una prueba global; o una persona, para repetirla |
| `module-test-done` | Prueba global terminada; el architect la analiza en la etapa `merge` | El workflow |
| `integration` | Tipo de issue: prueba global de un módulo. Su PR lleva el plan global a la rama principal y se fusiona la última | El architect, al crearlo |
| `needs-info` | Bloqueado esperando la respuesta de una persona | Cualquier agente |
| `human-review` | Pruebas no superadas (`FALLIDO`, `BLOQUEADO`), PR que no se puede fusionar o culpable de una prueba global fallida. Bloquea la etapa `merge` de todo el módulo | El workflow (tras `testPR`) o el architect (en `merge`); la quita una persona |
| `module:<modulo>` | Módulo de `specs/` afectado | El architect |

Después de `analysis`, que pone una persona, el recorrido es automático hasta la fusión del módulo o hasta que un issue se detiene en `needs-info` o `human-review`. Los cambios de etapa: el architect crea los hijos con `design`; de `design` a `develop` (el analyst-programmer, al publicar el plan final sin preguntas pendientes); de `develop` a `pr-raised` (el developer, al abrir la PR), de `pr-raised` a `merge` o `human-review` (el workflow, según el resultado de `testPR`) de `merge` a `human-review` (el architect), y el ciclo de la prueba global (`integration` lo crea el architect; `module-test` y `module-test-done` los pone el workflow). Un módulo bloquea su fusión mientras tenga algún issue abierto que no esté listo, **incluidos los que aún no han empezado**. Responder con un comentario en el issue vuelve a ejecutar la etapa de la etiqueta actual.

## Enlaces

- El cuerpo de un issue hijo empieza con `Padre: #<n>`.
- El padre mantiene una lista de tareas: `- [ ] #<hijo> <título>`.
- Dependencias entre hijos: `Depende de: #<n>`.
- Rama de trabajo de un issue hijo: `issue-<n>`. La crea el analista en la etapa `design`, la usa el programador en `develop` y el analista la prueba en `testPR`.

## Plantilla: issue de necesidad (lo abre una persona, etiqueta `analysis`)

```markdown
## Necesidad
<qué problema hay y para quién>

## Resultado esperado
<qué podrá hacer el usuario al terminar>

## Notas
<contexto, ejemplos, enlaces>
```

## Plantilla: issue de diseño (lo crea el architect con las etiquetas `design` y `module:<modulo>`)

```markdown
Padre: #<n>
Módulo: [`<modulo>`](specs/<modulo>/README.md)
Depende de: #<n> | ninguno

## Contexto
<por qué existe esta pieza, qué parte del producto toca, decisiones ya tomadas en el padre>

## Objetivo
<qué tiene que quedar funcionando, en una o dos frases>

## Arquitectura
<módulos implicados, flujo, contratos entre módulos, diagrama Mermaid si ayuda; con el porqué de cada decisión>

## Requisitos a cubrir
- RF-<MOD>-NN — <existente o nuevo, resumen>

## Criterios de aceptación
- CA-<MOD>-NN — Dado… Cuando… Entonces…

## Riesgos y recomendaciones
<errores a evitar, mejoras posibles>

## Fuera de alcance
<qué no incluye>
```

## Plantilla: borrador del analista (etapa `design`, paso 1)

```markdown
## Propuesta del analista (pendiente de revisión del arquitecto)

### Cambios en specs
- `specs/<modulo>/README.md`: <qué y por qué>
- `specs/<modulo>/design.md`: <qué y por qué>
- `specs/<modulo>/test-plan.md`: <casos PP añadidos o cambiados>
- Commit: <sha> en `issue-<n>`

### Plan de pruebas
- PP-<MOD>-NN — cubre CA-<MOD>-NN — <qué comprueba>

### Plan de acción (borrador)
<mismo formato que el plan final>

### Preguntas para el arquitecto
1. <pregunta> — Propuesta: <opción por defecto>
```

## Plantilla: revisión del arquitecto (etapa `design`, paso 2)

```markdown
VEREDICTO: APROBADO | CAMBIOS | PREGUNTA
## Revisión del arquitecto

### Valoración
<encaje con la arquitectura y con CLAUDE.md>

### Cambios solicitados
1. <cambio> — Motivo: <argumento>

### Respuestas al analista
1. <respuesta>

### Preguntas para el responsable del producto
<solo con veredicto PREGUNTA; numeradas, con propuesta por defecto>
```

## Plantilla: plan de acción para el desarrollador (etapa `design`, paso 3, último comentario)

```markdown
## Plan de acción para el desarrollador

### Contexto
<qué se construye y por qué, en pocas frases>

### Rama
`issue-<n>`

### Specs de referencia
- [`specs/<modulo>/README.md`](...) — RF-<MOD>-NN, CA-<MOD>-NN
- [`specs/<modulo>/design.md`](...)

### Ficheros
| Acción | Ruta | Contenido |
| --- | --- | --- |
| crear | `src/server/forms/form.repository.ts` | `findFormById(orgId, id)`, `listForms(orgId, filters)` |
| modificar | `prisma/schema.prisma` | añadir campo `status` a `Form` |

### Contratos
<firmas TypeScript, tipos, esquemas Zod, endpoints con método, ruta, cuerpo, respuestas y códigos HTTP>

### Pasos en orden
1. <paso concreto>

### Tests
- [ ] CA-<MOD>-NN — Vitest `<ruta>` — <casos>
- [ ] CA-<MOD>-NN — Playwright `<ruta>` — <flujo>

### Plan de pruebas
[`specs/<modulo>/test-plan.md`](...) — la PR tiene que superar PP-<MOD>-G1…G5 y PP-<MOD>-NN, PP-<MOD>-NN en la etapa `testPR`.

### Definición de hecho
- [ ] `npm run lint`, `npm run typecheck` y `npm test` en verde
- [ ] Tests nuevos citando los CA que cubren
- [ ] Commits en `issue-<n>` con Conventional Commits
- [ ] PR abierta con `Closes #<n>`
- [ ] Etiqueta del issue cambiada de `develop` a `pr-raised`

### Cambios respecto a la revisión del arquitecto
<qué se ha aplicado o argumentado>
```

## Plantilla: pull request (etapa `develop`)

```markdown
## Resumen
<qué cambia, en 2-4 viñetas>

## Requisitos cubiertos
- RF-<MOD>-NN, CA-<MOD>-NN

## Comprobaciones
- lint: ✅ · typecheck: ✅ · tests: ✅ (N tests) · e2e: ✅ / no aplica

## Notas para la revisión
<decisiones menores, puntos a mirar>

Closes #<n>
```

## Plantilla: resultado del plan de pruebas (etapa `testPR`, comentario en la PR)

```markdown
RESULTADO: SUPERADO | FALLIDO | BLOQUEADO
## Resultado del plan de pruebas

### Resumen
<rama, commit probado, plan usado (`specs/<modulo>/test-plan.md`) y conclusión en una o dos frases>

### Comprobaciones generales
| ID | Comando | Resultado |
| --- | --- | --- |
| PP-<MOD>-G1 | `npm run lint` | ✅ |

### Casos de prueba
| ID | Cubre | Resultado | Detalle |
| --- | --- | --- | --- |
| PP-<MOD>-01 | CA-<MOD>-01 | ❌ | <salida relevante o motivo> |

### Comprobaciones manuales pendientes
- [ ] <comprobación para la persona que fusiona>

### Siguiente paso
<FALLIDO: qué tiene que corregir el developer · BLOQUEADO: qué falta en el plan · SUPERADO: listo para la etapa merge>
```

## Plantilla: etapa merge (architect, comentario en el issue)

```markdown
FUSIÓN: COMPLETA | PARCIAL | NINGUNA | PRUEBA-GLOBAL
## Etapa merge

### Camino elegido
<A prueba global · B prueba global fallida · C fusión> — <por qué, con la visión de todo el módulo>
PRUEBA-GLOBAL: #<m>   ← solo en el camino A; el workflow lanza module-test con este issue

### Revisión
| Issue | PR | Pruebas | CI | Se puede fusionar | Veredicto |
| --- | --- | --- | --- | --- | --- |
| #<n> | #<pr> | ✅ SUPERADO | ✅ | ✅ | aprobar y fusionar |

### Orden de fusión
1. #<pr> (#<n>) — <motivo: dependencia>

### Resultado
<qué PRs se han fusionado; si alguna no, por qué y qué issue pasa a `human-review`>

### Siguiente paso
<despliegue lanzado por el workflow · prueba global en curso · qué tiene que revisar una persona>
```

## Plantilla: issue de prueba global (lo crea el architect en la etapa merge)

Etiquetas: `integration` y `module:<modulo>`. El workflow añade `module-test`.

```markdown
Módulo: [`<modulo>`](specs/<modulo>/README.md)
Issues del módulo: #<n>, #<n>
PRs a probar juntas: #<pr>, #<pr>

## Por qué hace falta
<qué está "en el aire" entre las piezas: contratos, migraciones, ficheros o flujos compartidos>

## Qué hay que probar
1. <escenario que cruza varias PRs> — Resultado esperado: <comprobable>

## Fuera de alcance
<lo que ya cubren los planes de cada PR>
```

## Plantilla: resultado de la prueba global del módulo (module-test, comentario en el issue integration)

```markdown
RESULTADO: SUPERADO | FALLIDO | BLOQUEADO
## Resultado de la prueba global del módulo

### Resumen
<rama `issue-<m>` (rama principal + PRs #…), commit probado, sección "Pruebas globales del módulo" de `specs/<modulo>/test-plan.md`>

### Comprobaciones generales
| ID | Comando | Resultado |
| --- | --- | --- |

### Casos globales
| ID | Escenario | Resultado | Detalle |
| --- | --- | --- | --- |
| PP-<MOD>-M1 | <escenario> | ❌ | <salida relevante> |

### Causa probable (para el arquitecto)
<qué PR o issue provoca cada fallo>
```

## Comunicación entre agentes

- Dirígete al nivel correcto: "Para el arquitecto: …", "Para el analista: …".
- Si necesitas una decisión humana: explica qué falta, propón una opción por defecto, añade `needs-info` y detente.
- Escribe en el idioma del hilo (español por defecto). Nunca pegues secretos, tokens ni datos personales de respuestas.
