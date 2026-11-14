# Organizaciones, usuarios y autenticación

- **Prefijo:** `AUT`
- **Estado:** borrador
- **Responsable:** analyst-programmer (escribe), architect (revisa)

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
| RNF-AUT-04 | Should | Límite de intentos de inicio de sesión para frenar fuerza bruta. |

## Datos

- Posee: `Organization`, `User`, sesiones e invitaciones.
- `Organization` incluye los datos de tema (ver [theming](../theming/README.md)).

## Dependencias

- Depende de: [platform](../platform/README.md).
- Lo usan: todos los módulos de negocio.

## Criterios de aceptación

- **CA-AUT-01** — Dado un administrador de la organización A, cuando pide un formulario de la organización B por su id, entonces recibe 404.
- **CA-AUT-02** — Dado un `collector`, cuando intenta abrir `/admin`, entonces se le redirige a la app de recogida.
- **CA-AUT-03** — Dada una invitación enviada, cuando el invitado abre el enlace y crea su contraseña, entonces queda en la organización con el rol indicado.

## Supuestos y preguntas abiertas

- ¿Los trabajadores de campo tendrán cuenta (`collector`) o rellenarán sobre todo formularios públicos? Propuesta: ambos, con formularios públicos por defecto en la demo.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
