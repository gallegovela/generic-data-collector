# Organizaciones, usuarios y autenticación

- **Prefijo:** `AUT`
- **Estado:** diseñado
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #1 (análisis), #4 (diseño), #18 (análisis), #20 (límite de login y trazabilidad)

## Objetivo

Permitir que varias organizaciones (clientes) usen la misma instalación con sus datos totalmente aislados, y que sus usuarios inicien sesión con un rol que determina lo que pueden hacer.

## Alcance

**Incluido**
- Entidades `Organization` y `User`; roles `admin` y `collector`.
- Inicio de sesión con email y contraseña o enlace mágico (Auth.js).
- Invitación de usuarios por email desde el panel.
- Aislamiento por `organizationId` en todas las consultas.

**Fuera de alcance**
- SSO corporativo, pagos y suscripciones, un usuario en varias organizaciones.
- Alta de organizaciones nuevas desde la interfaz (self-service): en el piloto, las organizaciones y su primer administrador se crean con el seed de datos de ejemplo ([demo-seed](../demo-seed/README.md)); a partir de ahí, todo usuario nuevo entra por invitación (RF-AUT-04).
- La marca "pública/restringida" de un formulario concreto (el campo en sí, dentro de `Form`): ese dato lo añade [form-publishing](../form-publishing/README.md) cuando exista la entidad `Form`. Este módulo entrega la parte de infraestructura de RF-AUT-08: las rutas de relleno (`/f/[slug]/**`) no pasan por el guardián de sesión, para que puedan ser públicas por defecto; la variante "restringida a usuarios de la organización" la completará `form-publishing` reutilizando `getCurrentOrg`/`requireSession` de este módulo. Ver [design.md](design.md#resumen).

## Actores

| Actor | Qué hace |
| --- | --- |
| Administrador | Gestiona la organización, invita usuarios, crea formularios y ve respuestas. |
| Recolector (`collector`) | Rellena formularios asignados a su organización. |
| Persona anónima | Rellena un formulario publicado como público mediante enlace o QR. |

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-AUT-01 | Must | Un usuario inicia sesión con email y contraseña. |
| RF-AUT-02 | Should | Un usuario puede iniciar sesión con un enlace mágico enviado por email. |
| RF-AUT-03 | Must | Cada usuario pertenece a una única organización y tiene rol `admin` o `collector`. |
| RF-AUT-04 | Must | Un administrador puede invitar usuarios por email indicando su rol. |
| RF-AUT-05 | Must | Un administrador puede desactivar usuarios de su organización. |
| RF-AUT-06 | Must | Las rutas del panel solo son accesibles para `admin`; el `collector` solo accede a la app de recogida. |
| RF-AUT-07 | Must | Todas las lecturas y escrituras de datos de negocio se filtran por la organización del usuario autenticado (o de la API key). |
| RF-AUT-08 | Should | Un formulario publicado puede marcarse como público (sin inicio de sesión) o restringido a usuarios de la organización. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-AUT-01 | Must | Contraseñas con hash robusto (bcrypt o argon2). |
| RNF-AUT-02 | Must | Ningún endpoint devuelve datos de otra organización, incluso adivinando identificadores. |
| RNF-AUT-03 | Must | Sesiones con cookie `httpOnly`, `secure` y `sameSite`. |
| RNF-AUT-04 | Should | Límite de intentos de inicio de sesión con contraseña para frenar fuerza bruta: **solo cuentan los intentos fallidos** (contraseña incorrecta, email inexistente o usuario inactivo) por email normalizado. Con 5 fallos en 15 minutos, el email queda bloqueado hasta que el más antiguo salga de la ventana; mientras está bloqueado, ni siquiera la contraseña correcta inicia sesión. Un inicio de sesión correcto reinicia el contador de ese email; el contador también se reinicia al terminar la ventana. Los logins correctos no consumen cupo. El enlace mágico no tiene límite de intentos. |
| RNF-AUT-05 | Should | Trazabilidad de los fallos de inicio de sesión: cada fallo (contraseña o enlace mágico) deja en el log una línea JSON con el motivo (`invalid_credentials`, `inactive_user`, `rate_limited`, `internal_error`; `invalid_token` en el enlace mágico), sin email, contraseña, token ni ningún identificador derivado del email. En `internal_error` solo se registra la clase del error, nunca su mensaje. La interfaz no permite distinguir entre email inexistente, usuario inactivo y contraseña incorrecta (RNF-AUT-02). |

## Datos

- Posee: `Organization`, `User`, invitaciones (`Invitation`) y tokens de enlace mágico (`LoginToken`). La sesión en sí no se persiste en base de datos: se codifica en una cookie firmada (JWT), ver [design.md](design.md#resumen).
- `Organization` no incluye todavía los datos de tema: los añade [theming](../theming/README.md) en su propia migración, sobre el `Organization` que crea este módulo.

## Dependencias

- Depende de: [platform](../platform/README.md).
- Lo usan: todos los módulos de negocio.

## Criterios de aceptación

- **CA-AUT-01** — Dado un administrador de la organización A, cuando pide o modifica un recurso de la organización B por su id (por ejemplo, otro usuario), entonces el sistema responde como si no existiera (404), sin revelar que pertenece a otra organización. Este módulo lo demuestra con `User`, el único recurso propio con `organizationId`; es el mismo contrato (`getCurrentOrg` + repositorio filtrado) que usarán `Form` y `Submission` cuando existan.
- **CA-AUT-02** — Dado un `collector`, cuando intenta abrir `/admin`, entonces se le redirige a `/collect` (la app de recogida).
- **CA-AUT-03** — Dada una invitación enviada, cuando el invitado abre el enlace y crea su contraseña, entonces queda en la organización con el rol indicado y con sesión iniciada.
- **CA-AUT-04** — Dado un usuario activo con contraseña, cuando inicia sesión con el email y la contraseña correctos, entonces queda con sesión iniciada; con la contraseña incorrecta, se le informa del error sin iniciar sesión.
- **CA-AUT-05** — Dado un usuario activo que pide un enlace mágico, cuando abre ese enlace, entonces queda con sesión iniciada; si el enlace ya se usó o ha caducado, se le informa del error sin iniciar sesión.
- **CA-AUT-06** — Dado un usuario activo, cuando inicia sesión correctamente 5 o más veces seguidas con su email, entonces ninguno de esos inicios queda bloqueado por el límite de intentos.
- **CA-AUT-07** — Dado un email con 4 fallos de login recientes, cuando el usuario inicia sesión correctamente, entonces el contador de ese email se reinicia (hacen falta otros 5 fallos para bloquearlo).
- **CA-AUT-08** — Dado un email con 5 fallos de login en 15 minutos, cuando se intenta el 6.º inicio de sesión, aunque la contraseña sea correcta, entonces no se inicia sesión, se muestra «Demasiados intentos, prueba de nuevo más tarde» y se registra el motivo `rate_limited`.
- **CA-AUT-09** — Dado un login con email inexistente, con usuario inactivo o con contraseña incorrecta, entonces la pantalla muestra exactamente el mismo mensaje en los tres casos («Email o contraseña incorrectos.»), mientras que el log distingue `invalid_credentials` de `inactive_user`.
- **CA-AUT-10** — Dado cualquier fallo de login (contraseña o enlace mágico), entonces se escribe una única línea JSON `{"event":"auth.login_failed","provider":...,"reason":...}` que no contiene el email, la contraseña ni el token.

## Supuestos y preguntas abiertas

- **Resuelto (#4)** — ¿Los trabajadores de campo tendrán cuenta (`collector`) o rellenarán sobre todo formularios públicos? Se adopta la propuesta: ambos. Un `collector` tiene cuenta y accede a `/collect` (su app de recogida, protegida por sesión); un formulario publicado puede además marcarse público y rellenarse sin iniciar sesión en `/f/[slug]` (RF-AUT-08), sin pasar por el guardián de sesión de este módulo. El campo que marca un formulario como público lo añade `form-publishing` sobre `Form`; aquí solo se deja la ruta pública sin guardián. Ver [design.md](design.md#resumen).

## Historial de cambios

- 2026-11-14 — Creación del módulo.
- 2026-11-17 — Diseño técnico (#4): se resuelve la pregunta sobre cuentas `collector` frente a formularios públicos (ambos); se corrige que `Organization` **no** incluye todavía los datos de tema (los añadirá `theming` en su propia migración); se reformula CA-AUT-01 para que sea comprobable ya en este módulo (usando `User` como recurso de prueba, antes de que existan `Form`/`Submission`); se deja explícito que la parte "formulario marcado como público/restringido" de RF-AUT-08 la completa `form-publishing`, y que este módulo solo entrega la infraestructura (rutas `/f/**` sin guardián de sesión); se añaden CA-AUT-04 (login con contraseña, RF-AUT-01) y CA-AUT-05 (login con enlace mágico, RF-AUT-02), que no tenían criterio propio.
- 2026-11-24 — Login: motivo de los fallos y límite solo de fallos (#20): se reformula RNF-AUT-04 (cuenta solo fallos; un login correcto reinicia el contador; el bloqueo impide incluso la contraseña correcta); nuevo RNF-AUT-05 (trazabilidad de fallos sin datos personales); nuevos CA-AUT-06 a CA-AUT-10 (el límite no existía como criterio). No se renumera nada.
