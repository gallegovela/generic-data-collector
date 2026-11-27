# Ajustes de administración y planes de uso

- **Prefijo:** `SET`
- **Estado:** diseñado
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #23 (petición), #40 (diseño y desarrollo)

## Objetivo

Dar a los administradores una sección de configuración (`/admin/settings`) y, dentro de ella, la gestión de **planes de uso**: un plan define límites por formulario (impresiones por hora, recepciones de respuestas por hora y tamaño máximo de archivo). La aplicación aplica los límites del plan de la organización al recibir respuestas y subir archivos. Hoy los planes solo son configurables; en el futuro serán los planes comerciales.

## Alcance

**Incluido**
- Sección `/admin/settings` solo para `admin`, con estructura de subsecciones ampliable. Hoy solo «Planes» (`/admin/settings/plans`).
- Listado, creación, edición y borrado de planes.
- Asignar un plan a la propia organización.
- Servicio de límites (`src/server/admin-settings/`): límites efectivos de una organización y contadores por formulario y hora natural (UTC), con «límite alcanzado».
- Aplicación del límite de recepciones (`createSubmission`) y del tamaño de archivo (`uploadFile`).
- Contador de impresiones y comprobación, listos para usar (sin engancharlos a ninguna pantalla).
- Plan «Genérico» creado por migración y asignado a todas las organizaciones existentes; el seed lo mantiene.

**Fuera de alcance**
- Facturación, pagos y suscripciones; precios; planes por organización.
- Rol de plataforma (ver «Limitaciones conocidas»).
- Enganchar el límite de impresiones en `/f/<slug>`: pieza posterior de `field-collector`, cuando #33 esté fusionada.
- Otras subsecciones de ajustes (tema, usuarios) más allá de dejar la estructura preparada.
- Traducir `PlanLimitError` a la respuesta HTTP de la ruta pública de recepción (la crea `field-collector`).
- Limpieza de contadores antiguos (el piloto genera una fila por formulario, tipo y hora; se aplaza).

## Actores

| Actor | Qué hace en este módulo |
| --- | --- |
| Administrador | Abre `/admin/settings`, gestiona planes y asigna el plan de su organización. |
| Colector / anónimo | No puede abrir la sección ni llamar a sus acciones. Sufre los límites al enviar respuestas y subir archivos. |

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-SET-01 | Must | `/admin/settings` y todas sus subrutas solo las abre un `admin`. Un `collector` es redirigido a `/collect` y un anónimo a `/login`. Todas las server actions del módulo exigen sesión `admin` (401 / 403 si no). |
| RF-SET-02 | Must | La sección tiene una barra de subsecciones y una página índice que redirige a la primera (`/admin/settings/plans`). Añadir una subsección es añadir una entrada a una lista y una página, sin tocar el resto. El menú de `/admin` gana el enlace «Ajustes». |
| RF-SET-03 | Must | Un `Plan` tiene nombre (único, 1–80 caracteres), `maxImpressionsPerHour`, `maxSubmissionsPerHour` y `maxFileBytes`. Cada límite es un entero positivo o nulo; nulo significa «sin límite». |
| RF-SET-04 | Must | El administrador puede listar planes (con el número de organizaciones que los usan), crearlos y editarlos. |
| RF-SET-05 | Must | No se puede borrar un plan asignado a alguna organización ni el último plan que queda. |
| RF-SET-06 | Must | El administrador puede cambiar el plan asignado a **su propia** organización; nunca el de otra. Toda organización tiene siempre un plan (`Organization.planId` obligatorio). |
| RF-SET-07 | Must | Una migración crea el plan «Genérico» (id fijo `plan-generic`; 10 000 impresiones/h, 1 000 recepciones/h, 10 485 760 bytes) y lo asigna a todas las organizaciones existentes. El seed lo garantiza. |
| RF-SET-08 | Must | `getEffectiveLimits(organizationId)` devuelve los límites del plan de la organización. |
| RF-SET-09 | Must | `consumeUsage` cuenta, por organización, formulario, tipo (`impression` / `submission`) y hora natural UTC, y rechaza (resultado `allowed: false`) cuando el contador ya está en el límite. El incremento es atómico (sin pasar del límite aunque haya peticiones simultáneas). Con límite nulo siempre permite y cuenta. |
| RF-SET-10 | Must | Los contadores de una organización o de un formulario no afectan a los de otro. No guardan IP ni datos de personas (solo `organizationId`, `formId`, tipo, hora y cuenta). |
| RF-SET-11 | Must | `createSubmission` consume cupo de recepciones solo para una respuesta nueva; si se supera, lanza `PlanLimitError` y no crea la `Submission`. Un reenvío idempotente de un `clientId` ya guardado no consume cupo. |
| RF-SET-12 | Must | `uploadFile` rechaza con `PayloadTooLargeError` un archivo mayor que `maxFileBytes` del plan, sin superar nunca el tope técnico global `STORAGE_MAX_UPLOAD_BYTES`. No se guarda nada. |
| RF-SET-13 | Must | El servicio expone `consumeUsage(…, "impression")` y `getUsage` para impresiones, con test unitario. No se engancha a `/f/<slug>` en este módulo. Una «impresión» es una carga de la pantalla de relleno de un formulario publicado. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-SET-01 | Must | Toda consulta de datos de organización filtra por `organizationId`. `Plan` es global (ver limitaciones). |
| RNF-SET-02 | Must | Los textos de la interfaz están en español y centralizados para poder traducirse (i18n). La interfaz está pensada para ordenador. |
| RNF-SET-03 | Must | Sin Redis ni colas: contadores en PostgreSQL. Los logs no contienen contenido de respuestas ni datos personales. |

## Flujos principales

```mermaid
flowchart LR
  A[Admin] --> S[/admin/settings/plans]
  S --> P[(Plan)]
  S --> O[Organization.planId]
  R[createSubmission] --> L[getEffectiveLimits]
  U[uploadFile] --> L
  R --> C[consumeUsage submission]
  C --> N[(UsageCounter)]
```

## Datos

- Posee: `Plan` y `UsageCounter` (contador por organización, formulario, tipo y hora).
- Modifica: `Organization` (añade `planId`).
- Lee: `Submission` y `StoredFile` solo a través de sus servicios.

## Dependencias

- Depende de: [`tenancy-auth`](../tenancy-auth/README.md) — sesión, rol `admin` y layout `/admin`.
- Modifica el comportamiento de: [`submissions-dashboard`](../submissions-dashboard/README.md) (RF-SUB-13) y [`file-storage`](../file-storage/README.md) (RF-STO-12).
- Lo usará: `field-collector` (límite de impresiones en `/f/<slug>`, error `PlanLimitError` → HTTP 429).

## Criterios de aceptación

- **CA-SET-01** — Dado un `collector`, cuando abre `/admin/settings`, entonces se le deniega el acceso (redirección a `/collect`); un anónimo va a `/login`, y las acciones del módulo lanzan `ForbiddenError`/`UnauthorizedError`. (RF-SET-01)
- **CA-SET-02** — Dado un admin, cuando fija `maxSubmissionsPerHour` a 2 y se envían 3 respuestas distintas a un formulario en la misma hora, entonces la tercera lanza `PlanLimitError` y no se crea la `Submission`. (RF-SET-09, RF-SET-11)
- **CA-SET-03** — Dado el mismo caso, cuando se reenvía la primera respuesta con su `clientId`, entonces no consume cupo y devuelve la ya guardada (`created: false`). (RF-SET-11)
- **CA-SET-04** — Dado un plan con `maxFileBytes` de 1 MB, cuando se sube un archivo de 2 MB, entonces se rechaza con un error claro y no se guarda; uno de 500 KB se acepta. (RF-SET-12)
- **CA-SET-05** — Dado un plan con todos los límites nulos, entonces no se rechaza nada por límite de plan. (RF-SET-03, RF-SET-09)
- **CA-SET-06** — Dadas dos organizaciones, entonces los contadores de una no afectan a la otra. (RF-SET-10)
- **CA-SET-07** — Tras aplicar la migración sobre una base con organizaciones existentes, todas tienen el plan «Genérico» y el seed sigue funcionando. (RF-SET-07)
- **CA-SET-08** — Dado `maxImpressionsPerHour` = N, cuando se consumen N impresiones, entonces la siguiente devuelve `allowed: false` (test unitario). (RF-SET-13)
- **CA-SET-09** — Dado un plan asignado a una organización, o el último plan, cuando se intenta borrar, entonces se rechaza con `ConflictError`. (RF-SET-05)
- **CA-SET-10** — Dado un admin de la organización A, cuando asigna un plan, entonces solo cambia el plan de A; no existe forma de indicar otra organización. (RF-SET-06)
- **CA-SET-11** — Dado 20 consumos simultáneos con límite 5, entonces exactamente 5 se permiten. (RF-SET-09)

## Limitaciones conocidas y deuda

- **Los planes son globales, no por organización.** En el piloto hay una organización y cualquier `admin` puede crear, editar y borrar cualquier plan. En un SaaS multi-tenant real un admin de una organización no debe editar planes ajenos. **Punto de extensión propuesto (no implementado):** un rol de plataforma (por ejemplo `User.isPlatformAdmin` o un valor `platform` en `Role`) que sea el único que escriba en `Plan`; los `admin` de organización solo podrían elegir entre planes. Todos los puntos de escritura pasan por `assertCanManagePlans(user)` en `plan.service.ts`, hoy equivalente a «es admin», para sustituirlo en un solo lugar.
- **Límite por plan frente al límite por IP de `field-collector` (#33).** Son cosas distintas: el de #33 es anti-abuso técnico (por IP, para proteger el servicio); el del plan es comercial (por formulario y hora, lo que la organización ha contratado). Ambos pueden aplicarse a la misma petición; ninguno sustituye al otro.
- La hora es natural en UTC (ventana fija, no deslizante): un pico a las 10:59 y otro a las 11:00 pueden sumar el doble del límite en dos minutos. Aceptado en el piloto.
- Las filas de `UsageCounter` no se purgan.

## Supuestos y preguntas abiertas

- Valores del plan «Genérico» propuestos por el analista: generosos para no romper la demo (RF-SET-07).
- `Submission.formId` y `UsageCounter.formId` son identificadores lógicos sin clave foránea (como el resto de datos de respuestas).

## Historial de cambios

- 2026-11-27 — Creación del módulo: RF-SET-01 a RF-SET-13, RNF-SET-01 a RNF-SET-03, CA-SET-01 a CA-SET-11 (#40).
