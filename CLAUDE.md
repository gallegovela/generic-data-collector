# CLAUDE.md

Guía del proyecto para Claude Code. Léela antes de cualquier tarea.

Reglas de oro:

- **La especificación manda.** Cada módulo del software se define en `specs/<modulo>/` antes de escribir código. Si el código y la especificación no coinciden, se para y se corrige primero la especificación (o se pregunta).
- **Cinco etapas, tres agentes.** El trabajo pasa por `analysis` (arquitecto), `design` (analista programador, revisado por el arquitecto), `develop` (programador), `testPR` (analista programador, con la etiqueta `pr-raised`) y `merge` (arquitecto), coordinados mediante issues de GitHub. Ver [Agentes y flujo de trabajo](#agentes-y-flujo-de-trabajo).

## Qué es el proyecto

**Nombre provisional:** FormIA

Plataforma SaaS para crear formularios de recogida de datos, pensada para pymes y autónomos que todavía usan papel, Excel o WhatsApp: partes de obra, inspecciones, pedidos en ruta, encuestas de satisfacción o recogida de documentación de clientes.

Qué la diferencia de Google Forms, Jotform o Kizeo:

- **Asistente de IA**: crea el formulario a partir de una descripción en lenguaje natural o de una foto del formulario en papel.
- **Personalización completa**: logo, colores, tipografía y estilo de cada cliente.
- **Uso en campo**: funciona sin conexión y recoge fotos, firma y GPS.
- **Varias salidas para los datos**: email, exportación a Excel, CSV o PDF, fichas en un panel online, webhooks y API.
- **Datos bajo control**: alojamiento en la UE, cumplimiento del RGPD y posibilidad de instalación privada.

## Objetivo actual: piloto de demostración

Lo que se construye ahora es un **piloto para enseñar a posibles clientes**, no el producto definitivo. Prioridades, en este orden:

1. Que la demostración funcione de principio a fin sin fallos.
2. Que tenga buen aspecto visual.
3. Que el código sea simple y fácil de cambiar.

No sobredimensionar: nada de microservicios, colas ni multirregión en esta fase.

### Recorrido de la demo (el camino que tiene que funcionar siempre)

1. El administrador entra y crea un formulario:
   - describiéndolo con el asistente de IA ("parte diario de obra con fotos y firma del encargado"), o
   - subiendo una foto de un formulario en papel.
2. Ajusta el formulario en el editor visual: campos, orden, obligatorios, logo y colores.
3. Lo publica y obtiene un enlace o un código QR.
4. Un trabajador lo rellena desde el móvil, también sin conexión, con foto, firma y GPS.
5. La respuesta aparece como ficha en el panel, llega por email en PDF y se puede exportar a Excel.

## Alcance del piloto

**Incluido**
- Editor de formularios con arrastrar y soltar.
- Tipos de campo: texto, número, fecha y hora, selección única o múltiple, sí/no, foto, firma, GPS, sección o título.
- Lógica condicional básica: mostrar u ocultar un campo según otra respuesta.
- Tema por organización: logo, color principal, color secundario, tipografía.
- Asistente de IA para crear y modificar formularios.
- Aplicación web instalable (PWA) para rellenar formularios, con modo sin conexión y sincronización al recuperar la red.
- Panel de respuestas: listado, ficha de detalle y filtros.
- Salidas: email con PDF, exportación a Excel y CSV, webhook por formulario.
- API REST básica de solo lectura para consultar respuestas.
- Varias organizaciones en la misma instalación (multi-tenant sencillo).

**Fuera de alcance por ahora**
- Pagos y suscripciones.
- Apps nativas para iOS o Android.
- Inicio de sesión corporativo (SSO).
- Flujos de aprobación con varios pasos.
- Integraciones con ERP o software de contabilidad concretos.

## Especificaciones (`specs/`)

Todo módulo del proyecto está creado y documentado en ficheros Markdown bajo la carpeta `specs/`. Es la fuente de verdad funcional y técnica: los agentes y las personas leen la especificación antes de diseñar o programar, y la actualizan en el mismo cambio que modifica el comportamiento.

Estructura:

```text
specs/
├── README.md                 # índice de módulos, estado y convenciones
├── _template/                # plantillas para crear un módulo nuevo
│   ├── README.md             # plantilla de requisitos
│   ├── design.md             # plantilla de diseño técnico
│   └── test-plan.md          # plantilla del plan de pruebas
└── <modulo>/                 # un subdirectorio por módulo, nombre en inglés kebab-case
    ├── README.md             # OBLIGATORIO: objetivo, alcance, requisitos, criterios de aceptación
    ├── design.md             # diseño técnico: capas, ficheros, contratos, tests (analista)
    ├── test-plan.md          # plan de pruebas que se ejecuta antes de fusionar la PR (analista)
    └── *.md                  # opcional: flujos, decisiones (ADR), modelos de datos, etc.
```

Reglas:

- Cada subdirectorio de `specs/` es un módulo y tiene **al menos un `README.md`** con sus requisitos principales.
- Los requisitos se numeran con un prefijo por módulo y no se renumeran nunca: `RF-<MOD>-01` (funcional), `RNF-<MOD>-01` (no funcional), `CA-<MOD>-01` (criterio de aceptación). Si un requisito se elimina, se marca como `~~retirado~~`, no se borra su número.
- Los issues, commits y tests citan los identificadores de requisito que cubren (`Cubre: RF-FSC-03`).
- Quien escribe en `specs/` es el **analista programador** (el `README.md` de requisitos, el `design.md` y el `test-plan.md`), siempre en la rama `issue-<n>` y bajo la revisión del **arquitecto**, que propone y argumenta los cambios en el issue pero no edita ficheros. El **programador** no cambia las especificaciones: si encuentra una contradicción, la anota en el issue y se detiene en ese punto.
- Un módulo nuevo se crea copiando `specs/_template/` y se registra en el índice `specs/README.md`.
- Textos de las especificaciones en español; nombres de módulo, rutas, tipos y código en inglés.

## Agentes y flujo de trabajo

El proyecto se desarrolla con tres agentes de Claude Code, definidos en `.claude/agents/`, y con skills propias en `.claude/skills/`. Cada agente tiene un nivel de responsabilidad y no invade el de los demás.

El trabajo avanza por issues de GitHub en cinco etapas. Cada etapa se activa poniendo su etiqueta en el issue y la ejecuta un agente:

| Etapa (etiqueta) | Agente | Qué recibe | Qué entrega | Skills |
| --- | --- | --- | --- | --- |
| `analysis` | `architect` (arquitecto) | Una necesidad del producto, en un issue o en conversación | Comentario con la arquitectura argumentada, errores y mejoras detectados y recomendaciones; un issue hijo por cada pieza de desarrollo | `requirements-analysis`, `software-architecture`, `spec-writing`, `github-issues` |
| `design` | `analyst-programmer` (analista programador), revisado por el `architect` | Un issue hijo creado por el arquitecto | Rama `issue-<n>` con `specs/` actualizado (requisitos, diseño y plan de pruebas), y como **último comentario** del issue el plan de acción para el desarrollador | `technical-design`, `spec-writing`, `test-plan`, `github-issues` |
| `develop` | `developer` (programador) | El issue con su plan de acción y la rama `issue-<n>` | Código y tests en la rama `issue-<n>`, una pull request que cierra el issue, y la etiqueta del issue cambiada de `develop` a `pr-raised` | `nextjs-development`, `github-issues` |
| `testPR` (etiqueta `pr-raised`) | `analyst-programmer` (analista programador) | El issue con la PR abierta y `specs/<modulo>/test-plan.md` | El plan de pruebas ejecutado sobre la rama de la PR y el resultado (`SUPERADO`, `FALLIDO` o `BLOQUEADO`) como comentario en la PR; el workflow cambia `pr-raised` por `merge` (superado) o `human-review` (resto) | `test-plan`, `github-issues` |
| `merge` | `architect` (arquitecto) | Un issue que acaba de pasar a `merge` | Si todos los issues en curso de su módulo (`module:<modulo>`) están en `merge`, sus PRs revisadas y fusionadas en orden de dependencias y el despliegue lanzado; si no, un comentario con lo que falta | `software-architecture`, `github-issues` |

### Recorrido de una funcionalidad

```text
issue (etiqueta analysis) ──► architect: arquitectura, errores, mejoras ──► issues hijos (uno por pieza)
                                                                                 │  una persona pone "design"
                                                                                 ▼
issue hijo (etiqueta design) ──► analyst-programmer: rama issue-<n> + specs/ + borrador del plan
                                     ▲          │
                                     │          ▼
                                     └── architect: revisión con veredicto (APROBADO / CAMBIOS / PREGUNTA)
                                                │
                                                ▼
                                 analyst-programmer: plan de acción final (último comentario)
                                                │  una persona pone "develop"
                                                ▼
issue hijo (etiqueta develop) ──► developer: código + tests en issue-<n> ──► pull request
                                                │  el developer cambia develop por pr-raised
                                                ▼
issue hijo (etiqueta pr-raised) ──► analyst-programmer: ejecuta specs/<modulo>/test-plan.md ──► resultado en la PR
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼ SUPERADO                                            ▼ FALLIDO / BLOQUEADO
issue hijo (etiqueta merge)                                 issue hijo (etiqueta human-review)
                     │                                       una persona revisa; vuelve a pr-raised o a merge
                     ▼
architect: ¿todos los issues en curso del módulo en merge?
     │ no: espera y comenta qué falta          │ sí: revisa y fusiona las PRs en orden
     ▼                                         ▼
(se repite cuando otro issue del módulo     main ──► deploy.yml
 pasa a merge)
```

1. **Análisis (`analysis`, arquitecto).** Lee el issue y todo su hilo, analiza el proyecto en conjunto y propone la arquitectura argumentando cada decisión. Señala errores, contradicciones, riesgos y posibles mejoras, tanto en la petición como en `specs/`, y da recomendaciones sobre cómo actuar. Crea un issue hijo por cada pieza de desarrollo (normalmente uno por módulo afectado), con el contexto, el objetivo y la arquitectura de esa pieza. No edita ficheros del repositorio. También se puede hablar con él directamente con `claude --agent architect`.
2. **Diseño (`design`, analista programador bajo control del arquitecto).** Se hace en tres pasos dentro de la misma ejecución:
   1. El analista crea o reutiliza la rama `issue-<n>`, actualiza `specs/` (requisitos, `design.md` y el plan de pruebas `test-plan.md`), hace commit y publica en el issue un borrador del plan con sus dudas para el arquitecto.
   2. El arquitecto revisa el borrador y el diff de `specs/`, argumenta sus observaciones y emite un veredicto: `APROBADO`, `CAMBIOS` o `PREGUNTA`.
   3. Si no hay pregunta para una persona, el analista aplica la revisión y publica como **último comentario** el plan de acción para el desarrollador: ficheros, contratos, pasos en orden, tests, plan de pruebas y definición de hecho.

   Las piezas de software que define el analista son las rutas y controladores (route handlers o server actions), los servicios, los repositorios de acceso a datos (el "DAO", con Prisma), los esquemas Zod, los componentes, las migraciones y los tests.
3. **Desarrollo (`develop`, programador).** Trabaja en la rama `issue-<n>` que creó el analista y sigue el último "Plan de acción para el desarrollador". Implementa, escribe los tests, deja el linter, la comprobación de tipos y los tests en verde, sube la rama y, cuando la tarea está lista, abre la pull request con `Closes #<n>` y cambia la etiqueta del issue de `develop` a `pr-raised`. No toma decisiones de diseño: si falta información, pregunta en el issue y se detiene.
4. **Pruebas de la PR (`testPR`, etiqueta `pr-raised`, analista programador).** Antes de fusionar, ejecuta sobre la rama de la PR el plan de pruebas `specs/<modulo>/test-plan.md`: preparación, comprobaciones generales y casos `PP-<MOD>-NN`. No corrige nada ni hace commits. Publica el resultado en la conversación de la PR, con `RESULTADO: SUPERADO`, `FALLIDO` o `BLOQUEADO` en la primera línea y las comprobaciones manuales pendientes. El workflow cambia la etiqueta: `merge` si el resultado es `SUPERADO`; `human-review` en cualquier otro caso, para que lo revise una persona.
5. **Fusión (`merge`, arquitecto).** Reúne todos los issues abiertos que comparten la etiqueta `module:<modulo>` con el issue. Si alguno sigue en curso (`design`, `develop`, `pr-raised`, `needs-info`), está en `human-review` o no tiene PR abierta, no hace nada y comenta qué falta; la etapa se repite cuando otro issue del módulo pasa a `merge`. Los issues sin etiqueta de etapa (aún sin empezar) no bloquean. Cuando todos están listos, el arquitecto revisa cada PR (resultado de `testPR`, CI en verde, sin conflictos, coherencia con `specs/`), las fusiona en orden de dependencias (`Depende de: #<n>`) y el workflow lanza `deploy.yml`. Si una PR no se puede fusionar, se detiene ahí y pone `human-review` en su issue.

### Aprobaciones y preguntas

- Cuando un agente necesita una decisión de una persona, deja la pregunta en el issue (numerada y con una propuesta por defecto), añade la etiqueta `needs-info` y se detiene.
- Al responder con un comentario en el issue, se vuelve a ejecutar la etapa de la etiqueta actual con el hilo completo.
- Pasar de una etapa a la siguiente es una decisión humana: poner `design` en los issues hijos que se aprueban y `develop` cuando el plan de acción es correcto. Las excepciones son automáticas: de `develop` a `pr-raised` (el programador, al abrir la PR, lanza `testPR`), de `pr-raised` a `merge` o `human-review` (el workflow, según el resultado de las pruebas) y de `merge` a `human-review` (el arquitecto, si una PR no se puede fusionar).
- `human-review` lo resuelve una persona: corrige o pide corregir, y vuelve a poner `pr-raised` para repetir las pruebas o `merge` si da la PR por buena.

### Convenciones de GitHub

- Etiquetas de etapa: `analysis`, `design`, `develop`, `pr-raised` (etapa `testPR`), `merge`. Etiquetas de estado: `needs-info` (bloqueado por una pregunta) y `human-review` (pruebas no superadas o PR que no se puede fusionar). Etiqueta de módulo: `module:<modulo>` (por ejemplo `module:form-schema`).
- Todo issue hijo enlaza a su padre (`Padre: #<n>`) y el padre mantiene una lista de tareas con sus hijos.
- Rama de trabajo: `issue-<n>`, donde `<n>` es el número del issue en etapa `design` y `develop`. La crea el analista y la usa el programador.
- Las plantillas de issue y de comentario están en la skill `github-issues` (`.claude/skills/github-issues/SKILL.md`).
- Los issues y comentarios se escriben en el idioma del hilo (español por defecto).
- Solo el arquitecto fusiona PRs, y solo en la etapa `merge`, cuando todos los issues en curso del módulo han superado sus pruebas. Ningún agente aprueba PRs. Una persona puede fusionar a mano en cualquier momento.

### Cómo invocar a los agentes

- Desde GitHub: poner la etiqueta de la etapa en el issue. El workflow `.github/workflows/issue-pipeline.yml` ejecuta el agente que corresponde.
- Conversación directa con un agente: `claude --agent architect` (o `analyst-programmer`, `developer`).
- Desde una sesión normal: pedir "usa el agente analyst-programmer con el issue #12" (o `@agent-developer`).

## Stack técnico

Decisiones iniciales; se pueden cambiar si hay un buen motivo, pero hay que hablarlo antes.

| Capa | Tecnología |
| --- | --- |
| Frontend y backend | Next.js (App Router) + TypeScript |
| Interfaz | Tailwind CSS + shadcn/ui |
| Editor de formularios | dnd-kit |
| Modo sin conexión | PWA (service worker) + IndexedDB con Dexie |
| Base de datos | PostgreSQL; definición de formularios y respuestas en JSONB |
| ORM | Prisma |
| Autenticación | Auth.js (email + contraseña o enlace mágico) |
| Archivos (fotos, firmas, logos) | Almacenamiento compatible con S3 (MinIO en local, Azure Blob en la nube) |
| IA | API de Anthropic (Claude) con salida JSON validada |
| Validación | Zod (un mismo esquema en cliente y servidor) |
| PDF | Generación en el servidor (react-pdf o similar) |
| Excel | exceljs |
| Email | SMTP (Brevo u otro proveedor) |
| Despliegue | Docker + docker-compose en local; Azure (contenedores) para la demo pública |

## Arquitectura y modelo de datos

La pieza central es el **esquema del formulario**: un JSON versionado que describe campos, lógica y tema. Ese mismo JSON lo usan el editor, el asistente de IA, el renderizador del móvil, el PDF y la exportación.

Entidades principales:

- `Organization`: cliente (tenant), con su tema visual.
- `User`: pertenece a una organización; rol `admin` o `collector`.
- `Form`: nombre, estado (`draft` o `published`) y versión publicada actual.
- `FormVersion`: esquema JSON inmutable. Cada publicación crea una versión nueva y las respuestas apuntan a la versión con la que se rellenaron.
- `Submission`: respuestas en JSONB, metadatos (dispositivo, GPS, fecha de captura y de sincronización) y referencias a archivos.
- `Destination`: salidas configuradas por formulario (email, webhook).
- `ApiKey`: claves de la API por organización.

Reglas:

- Toda consulta se filtra por `organizationId`. Nunca debe haber datos de una organización visibles para otra.
- El esquema del formulario se define una sola vez con Zod en `src/lib/form-schema` y se reutiliza en todas partes (ver `specs/form-schema/`).
- Cada respuesta lleva un `clientId` (UUID generado en el dispositivo) para que la sincronización sin conexión no cree duplicados.

## Asistente de IA

- La IA **nunca escribe directamente en la base de datos**. Devuelve un esquema JSON que se valida con Zod y se muestra al usuario como borrador para que lo revise.
- Entradas admitidas: texto libre, foto de un formulario en papel, o "modifica este formulario" junto con el esquema actual.
- Si la respuesta no pasa la validación, se reintenta una vez con el error incluido en el prompt; si vuelve a fallar, se muestra un error claro.
- Los prompts viven en `src/lib/ai/prompts/` y se versionan como código.
- No enviar a la IA datos de respuestas de clientes; solo definiciones de formularios.

## Datos personales y RGPD

- Alojamiento en la UE.
- No registrar en los logs contenido de las respuestas ni datos personales.
- Fotos y firmas siempre en almacenamiento privado, con URLs firmadas de corta duración.
- Exportar y borrar todos los datos de una organización tiene que ser posible (aunque en el piloto sea un script).
- Los secretos, en variables de entorno; nunca en el repositorio. Mantener `.env.example` al día.

## Convenciones

- Código, nombres de variables y commits en **inglés**. Textos de la interfaz en **español**, preparados para traducirse más adelante (i18n).
- TypeScript en modo `strict`, sin `any` salvo justificación.
- Componentes pequeños; lógica de negocio fuera de los componentes, en `src/lib/` o `src/server/`.
- Diseño pensado primero para móvil: el formulario se rellena en el móvil y el panel se usa sobre todo en ordenador.
- Commits con Conventional Commits (`feat:`, `fix:`, `chore:`…).
- Antes de dar una tarea por terminada: el código compila, pasa el linter y pasan los tests.

## Tests

- Vitest para la lógica: validación de esquemas, lógica condicional, exportaciones, generación del PDF.
- Playwright para el recorrido de la demo completo, incluido el modo sin conexión.
- Cualquier cambio en el esquema del formulario debe ir acompañado de tests.

## Comandos

Pendientes de crear al inicializar el proyecto. Objetivo:

```bash
docker compose up -d      # PostgreSQL, MinIO y Mailpit en local
npm run dev               # servidor de desarrollo
npm run lint              # linter
npm run typecheck         # comprobación de tipos
npm test                  # tests unitarios
npm run test:e2e          # tests de extremo a extremo
npm run db:migrate        # migraciones de Prisma
npm run db:seed           # datos de ejemplo para la demo
```

## Datos de ejemplo para la demo

El seed debe crear una organización de ejemplo con su logo y colores, y tres formularios listos para enseñar:

1. Parte diario de obra (fotos, firma, GPS).
2. Encuesta de satisfacción de cliente.
3. Alta de cliente para gestoría (datos personales y documentos).

Incluir algunas respuestas de ejemplo para que el panel no se vea vacío.

## Primeros pasos sugeridos

Cada paso corresponde a uno o varios módulos de `specs/` (ver el orden en `specs/README.md`).

1. Crear el proyecto Next.js con TypeScript, Tailwind, Prisma y docker-compose.
2. Definir el esquema del formulario con Zod y escribir sus tests.
3. Hacer el renderizador del formulario en móvil a partir del esquema.
4. Hacer el editor visual.
5. Añadir el asistente de IA.
6. Añadir el modo sin conexión y la sincronización.
7. Añadir las salidas: panel, PDF por email, Excel y webhook.
8. Preparar el seed de la demo y los tests de Playwright.

