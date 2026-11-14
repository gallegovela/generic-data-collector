---
name: github-issues
description: Cómo leer, crear, enlazar y comentar issues de GitHub en FormIA con la CLI gh - etiquetas por nivel (epic, analysis, development), plantillas de issue para cada nivel y reglas de comunicación entre agentes. Úsala siempre que leas o escribas en un issue.
---

# Issues de GitHub

## Comandos básicos (`gh`)

```bash
gh issue view <n> --comments                       # leer issue e hilo completo
gh issue list --label analysis --state open        # listar por etiqueta
gh issue create --title "<t>" --body-file <f> --label analysis --label module:<modulo>
gh issue comment <n> --body-file <f>               # comentar
gh issue edit <n> --add-label needs-info           # cambiar etiquetas
gh issue edit <n> --remove-label needs-info --add-label ready
gh issue edit <n> --body-file <f>                  # actualizar la lista de tareas del padre
gh label create <nombre> --color <hex> --description "<d>"   # si la etiqueta no existe
```

Escribe los cuerpos largos en un fichero temporal y pásalos con `--body-file`. Si `gh` no está disponible en el entorno, usa las herramientas de GitHub que haya (por ejemplo, las herramientas MCP de GitHub) con el mismo contenido.

## Etiquetas

| Etiqueta | Uso |
| --- | --- |
| `epic` | Necesidad grande del producto. La trata el arquitecto. |
| `analysis` | Pieza funcional con requisitos listos. La trata el analista programador. |
| `development` | Tarea de código diseñada. La trata el programador. |
| `needs-info` | Bloqueado esperando una respuesta. |
| `ready` | Listo para que lo tome el nivel correspondiente. |
| `module:<modulo>` | Módulo de `specs/` afectado. |

## Enlaces entre issues

- El cuerpo del hijo empieza con `Padre: #<n>`.
- El padre mantiene una lista de tareas: `- [ ] #<hijo> <título>`. Se marca al cerrarse el hijo.
- Dependencias: `Depende de: #<n>`.
- Si el repositorio admite sub-issues de GitHub, además se vinculan como sub-issue.

## Plantilla: issue `epic` (lo abre una persona o el arquitecto)

```markdown
## Necesidad
<qué problema hay y para quién>

## Resultado esperado
<qué podrá hacer el usuario al terminar>

## Notas
<contexto, ejemplos, enlaces>
```

## Plantilla: issue `analysis` (lo crea el arquitecto)

```markdown
Padre: #<n>
Módulo: [`<modulo>`](specs/<modulo>/README.md)

## Contexto
<por qué existe esta tarea, qué parte del producto toca, decisiones ya tomadas>

## Objetivo
<qué tiene que quedar funcionando, en una o dos frases>

## Requisitos que cubre
- RF-<MOD>-NN — <resumen>
- RNF-<MOD>-NN — <resumen>

## Diseño de alto nivel
<flujo, módulos implicados, contratos entre módulos, diagrama Mermaid si ayuda>

## Criterios de aceptación
- CA-<MOD>-NN — Dado… Cuando… Entonces…

## Fuera de alcance
<qué no incluye>

## Preguntas abiertas
<si las hay; si no, "Ninguna">
```

## Plantilla: issue `development` (lo crea el analista programador)

```markdown
Padre: #<n>
Módulo: [`<modulo>`](specs/<modulo>/design.md)
Depende de: #<n> | ninguno

## Objetivo
<qué hace esta tarea, en una frase>

## Ficheros
| Acción | Ruta | Contenido |
| --- | --- | --- |
| crear | `src/server/forms/form.repository.ts` | `findFormById(orgId, id)`, `listForms(orgId, filters)` |
| modificar | `prisma/schema.prisma` | añadir campo `status` a `Form` |

## Contratos
<firmas TypeScript, tipos, esquemas Zod, endpoints con método, ruta, cuerpo, respuestas y códigos HTTP>

## Detalles de implementación
<reglas de negocio paso a paso, casos límite, errores y mensajes en español>

## Tests
- [ ] Vitest: `<ruta del test>` — <casos>
- [ ] Playwright: `<ruta>` — <flujo> (si aplica)

## Criterios de aceptación
- CA-<MOD>-NN — …

## Definición de hecho
- [ ] `npm run lint`, `npm run typecheck` y `npm test` en verde
- [ ] Tests nuevos citando los CA que cubren
- [ ] Commit(s) en la rama `issue-<n>` con Conventional Commits
```

## Comentarios entre agentes

- Dirígete al nivel correcto: "Para el arquitecto: …", "Para el analista: …".
- Si te bloqueas: explica qué falta, propone una opción por defecto, añade `needs-info` y detente.
- Al terminar: resumen de lo hecho, enlaces a ficheros o commits y siguiente paso. Cambia `needs-info` por `ready` cuando corresponda.
- Escribe en el idioma del hilo (español por defecto). Nunca pegues secretos, tokens ni datos personales de respuestas.
