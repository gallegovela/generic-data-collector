# Editor visual de formularios

- **Prefijo:** `EDT`
- **Estado:** borrador
- **Dueño de los requisitos:** architect

## Objetivo

Que un administrador sin conocimientos técnicos cree y ajuste formularios con arrastrar y soltar, viendo en todo momento cómo quedará en el móvil.

## Alcance

**Incluido**
- Lista de formularios de la organización (crear, duplicar, archivar).
- Lienzo con los campos, paleta de tipos y panel de propiedades.
- Arrastrar y soltar para añadir y reordenar (dnd-kit).
- Configuración de lógica condicional básica.
- Vista previa móvil.
- Punto de entrada al asistente de IA.

**Fuera de alcance**
- Edición colaborativa en tiempo real, historial de deshacer entre sesiones.

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-EDT-01 | Must | El administrador ve el listado de formularios con nombre, estado, versión publicada, número de respuestas y fecha de modificación. |
| RF-EDT-02 | Must | Puede crear un formulario vacío, desde el asistente de IA o duplicando otro. |
| RF-EDT-03 | Must | Puede añadir campos arrastrándolos desde la paleta o pulsándolos. |
| RF-EDT-04 | Must | Puede reordenar campos arrastrando, también con teclado (accesibilidad). |
| RF-EDT-05 | Must | Puede editar las propiedades de cada campo: etiqueta, descripción, obligatorio y opciones específicas del tipo. |
| RF-EDT-06 | Must | Puede eliminar y duplicar campos. |
| RF-EDT-07 | Must | Puede definir una condición de visibilidad para un campo eligiendo campo origen, operador y valor. |
| RF-EDT-08 | Must | El borrador se guarda automáticamente; se indica "Guardado" o "Guardando…". |
| RF-EDT-09 | Must | Se muestra una vista previa con apariencia de móvil y el tema de la organización. |
| RF-EDT-10 | Must | El editor impide guardar un esquema inválido y señala el campo con el problema. |
| RF-EDT-11 | Should | Deshacer y rehacer dentro de la sesión (Ctrl+Z / Ctrl+Y). |
| RF-EDT-12 | Must | Desde el editor se puede pedir a la IA que modifique el formulario actual; el cambio propuesto se muestra antes de aplicarse. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-EDT-01 | Must | Uso principal en ordenador; usable en tablet. |
| RNF-EDT-02 | Should | Fluido con formularios de hasta 100 campos. |

## Dependencias

- Depende de: form-schema, theming, tenancy-auth, ai-assistant.
- Lo usan: form-publishing.

## Criterios de aceptación

- **CA-EDT-01** — Dado un formulario con tres campos, cuando se arrastra el tercero a la primera posición y se recarga la página, entonces el orden se conserva.
- **CA-EDT-02** — Dado un campo con condición sobre otro, cuando se elimina el campo origen, entonces el editor avisa y elimina o pide corregir la condición.
- **CA-EDT-03** — Dado un cambio en un campo, cuando pasan 2 s, entonces el borrador queda guardado sin pulsar ningún botón.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
