# Tema visual por organización

- **Prefijo:** `THM`
- **Estado:** borrador
- **Dueño de los requisitos:** architect

## Objetivo

Que cada cliente vea sus formularios, el panel y los PDF con su propia imagen: logo, colores y tipografía.

## Alcance

**Incluido**
- Tema por organización: logo, color principal, color secundario y tipografía.
- Aplicación del tema al formulario en el móvil, al PDF y a los emails.
- Vista previa en vivo en la pantalla de configuración.

**Fuera de alcance**
- CSS personalizado libre, temas distintos por formulario (posible más adelante).

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-THM-01 | Must | Un administrador puede subir el logo de la organización (PNG, JPG o SVG, máximo 1 MB). |
| RF-THM-02 | Must | Un administrador puede elegir color principal y secundario con selector de color o código hexadecimal. |
| RF-THM-03 | Must | Un administrador puede elegir la tipografía de una lista cerrada (al menos 5 fuentes). |
| RF-THM-04 | Must | El formulario en el móvil, el PDF y el email usan el tema de la organización. |
| RF-THM-05 | Should | La pantalla de tema muestra una vista previa en vivo de un formulario de ejemplo. |
| RF-THM-06 | Should | El sistema avisa si el contraste entre color de texto y fondo no cumple WCAG AA. |
| RF-THM-07 | Could | Al publicar, la versión del formulario guarda una copia del tema para que el PDF de respuestas antiguas no cambie. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-THM-01 | Must | El tema se aplica mediante variables CSS, sin recompilar la aplicación. |
| RNF-THM-02 | Must | Las fuentes se sirven desde la propia aplicación (sin llamadas a terceros desde el móvil del trabajador). |

## Dependencias

- Depende de: tenancy-auth (organización), file-storage (logo).
- Lo usan: field-collector, form-editor, outputs.

## Criterios de aceptación

- **CA-THM-01** — Dado un color principal cambiado, cuando se abre un formulario publicado, entonces botones y cabecera usan el nuevo color.
- **CA-THM-02** — Dado un logo subido, cuando se genera el PDF de una respuesta, entonces el logo aparece en la cabecera.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
