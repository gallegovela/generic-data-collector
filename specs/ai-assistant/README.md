# Asistente de IA

- **Prefijo:** `AI`
- **Estado:** borrador
- **Dueño de los requisitos:** architect

## Objetivo

Crear y modificar formularios a partir de una descripción en lenguaje natural o de la foto de un formulario en papel, devolviendo siempre un borrador que el administrador revisa antes de guardarlo.

## Alcance

**Incluido**
- Generación desde texto libre.
- Generación desde foto o PDF escaneado de un formulario en papel.
- Modificación de un formulario existente ("añade un campo de firma al final").
- Validación con Zod y un reintento automático.

**Fuera de alcance**
- Análisis de respuestas con IA, chat libre sobre los datos.

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-AI-01 | Must | El administrador puede describir un formulario en texto y obtener un borrador de esquema. |
| RF-AI-02 | Must | El administrador puede subir una foto (JPG, PNG, HEIC) o PDF de un formulario en papel y obtener un borrador equivalente. |
| RF-AI-03 | Must | El administrador puede pedir cambios sobre el formulario actual; se envía a la IA el esquema actual junto a la petición. |
| RF-AI-04 | Must | La salida de la IA se valida con el esquema Zod de `form-schema`. |
| RF-AI-05 | Must | Si la validación falla, se reintenta una vez incluyendo el error en el prompt; si vuelve a fallar se muestra un error claro en español. |
| RF-AI-06 | Must | La IA nunca escribe en base de datos: el resultado se muestra como borrador y el administrador lo acepta, lo descarta o lo ajusta en el editor. |
| RF-AI-07 | Must | En una modificación, se muestra qué campos se añaden, cambian o eliminan antes de aplicarla. |
| RF-AI-08 | Must | Los prompts se guardan como código en `src/lib/ai/prompts/` y llevan versión. |
| RF-AI-09 | Should | Se muestra el progreso mientras la IA responde (streaming o indicador). |
| RF-AI-10 | Should | Límite de peticiones por organización y día, configurable. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-AI-01 | Must | Solo se envían a la IA definiciones de formularios y las imágenes que sube el administrador; nunca datos de respuestas. |
| RNF-AI-02 | Must | Se usa la API de Anthropic con salida JSON estructurada; el modelo se configura por variable de entorno. |
| RNF-AI-03 | Should | Respuesta en menos de 30 s para formularios de hasta 40 campos. |
| RNF-AI-04 | Must | Se registran tokens, duración y resultado de cada llamada, sin el contenido. |

## Dependencias

- Depende de: form-schema, tenancy-auth.
- Lo usan: form-editor.

## Criterios de aceptación

- **CA-AI-01** — Dado el texto "parte diario de obra con fotos y firma del encargado", cuando se genera, entonces el borrador es válido e incluye al menos un campo `photo`, un campo `signature` y un campo de fecha.
- **CA-AI-02** — Dada una salida inválida de la IA dos veces seguidas, cuando termina el proceso, entonces se muestra un error y no se modifica el formulario.
- **CA-AI-03** — Dado un formulario existente y la petición "haz obligatorio el teléfono", cuando se aplica, entonces solo cambia la propiedad `required` de ese campo.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
