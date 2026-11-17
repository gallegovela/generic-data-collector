---
name: spec-writing
description: Convenciones para crear y mantener las especificaciones de módulos en specs/ - estructura de carpetas, plantillas, numeración de requisitos e índice. Úsala siempre que crees o modifiques cualquier fichero bajo specs/.
---

# Escritura de especificaciones (`specs/`)

## Estructura

- Un subdirectorio por módulo: `specs/<modulo>/`, nombre en inglés y kebab-case.
- `README.md` obligatorio (requisitos). Plantilla: `specs/_template/README.md`.
- `design.md` (diseño técnico). Plantilla: `specs/_template/design.md`.
- `test-plan.md` (plan de pruebas que se ejecuta antes de fusionar la PR, en la etapa `testPR`). Plantilla: `specs/_template/test-plan.md`. Ver la skill `test-plan`.
- Los tres los escribe el **analista programador** en la rama `issue-<n>` durante la etapa `design`. El **arquitecto** los propone y revisa en el issue, pero no los edita.
- Otros `.md` opcionales: `flows.md`, `data-model.md`, `adr-NNN-<titulo>.md`.
- Índice general en `specs/README.md`: añade una fila por módulo nuevo y actualiza su estado.

## Identificadores

- Cada módulo tiene un prefijo de 2 a 4 letras en mayúsculas, registrado en `specs/README.md` (por ejemplo `FSC` para `form-schema`).
- `RF-<MOD>-NN` funcional, `RNF-<MOD>-NN` no funcional, `CA-<MOD>-NN` criterio de aceptación, `PP-<MOD>-NN` caso del plan de pruebas (`PP-<MOD>-G<N>` para las comprobaciones generales).
- Los números nunca se reutilizan ni se renumeran. Un requisito eliminado se deja tachado con el motivo: `~~RF-FSC-07~~ (retirado: sustituido por RF-FSC-12)`.

## Estados de un módulo

`borrador` → `requisitos listos` → `diseñado` → `en desarrollo` → `hecho`. Se indica arriba del `README.md` y en el índice.

## Estilo

- Español claro, frases cortas, voz activa. Nombres de código, rutas y tipos en inglés y entre comillas invertidas.
- Requisitos verificables: nada de "rápido", "intuitivo" o "etc.".
- Diagramas en Mermaid dentro del Markdown.
- Enlaza a otros módulos con rutas relativas: `[form-schema](../form-schema/README.md)`.
- Mantén una sección "Historial de cambios" al final con fecha, cambio e issue: `2026-11-14 — Añadido RF-FSC-09 (#23)`.

## Al cambiar una especificación

1. Comprueba qué otros módulos dependen de lo que cambias (`grep -r "<modulo>" specs/`).
2. Actualiza los criterios de aceptación afectados y sus casos en `test-plan.md`.
3. Registra el cambio en el historial y referencia el issue.
4. Si cambia un contrato entre módulos, avisa en los issues abiertos de los módulos afectados.
