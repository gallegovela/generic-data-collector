# Privacidad y RGPD

- **Prefijo:** `GDPR`
- **Estado:** borrador
- **Dueño de los requisitos:** architect

## Objetivo

Reunir las reglas de protección de datos que aplican de forma transversal a todos los módulos y las herramientas para exportar y borrar los datos de una organización.

## Alcance

**Incluido**
- Reglas transversales (alojamiento, logs, almacenamiento, IA).
- Script de exportación completa de una organización.
- Script de borrado completo de una organización.
- Textos legales mínimos en el formulario público.

**Fuera de alcance**
- Portal de autoservicio para ejercer derechos, registro de actividades de tratamiento completo.

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-GDPR-01 | Must | Un script exporta todos los datos de una organización (base de datos en JSON y archivos) a un ZIP. |
| RF-GDPR-02 | Must | Un script borra todos los datos y archivos de una organización, pidiendo confirmación explícita. |
| RF-GDPR-03 | Should | Un administrador puede borrar una respuesta concreta y sus archivos desde el panel. |
| RF-GDPR-04 | Should | El formulario público muestra un texto informativo de protección de datos configurable por organización. |
| RF-GDPR-05 | Could | Un formulario puede tener un plazo de conservación tras el cual sus respuestas se borran. |

## Requisitos no funcionales (aplican a todos los módulos)

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-GDPR-01 | Must | Base de datos, archivos y copias alojados en la UE. |
| RNF-GDPR-02 | Must | Los logs no contienen valores de respuestas, nombres, emails, coordenadas ni imágenes. |
| RNF-GDPR-03 | Must | Fotos y firmas en almacenamiento privado con URLs firmadas de corta duración. |
| RNF-GDPR-04 | Must | A la IA solo se envían definiciones de formularios, nunca respuestas. |
| RNF-GDPR-05 | Must | Secretos en variables de entorno; `.env.example` al día. |
| RNF-GDPR-06 | Must | Comunicaciones siempre por HTTPS en entornos desplegados. |

## Dependencias

- Aplica a todos los módulos; usa submissions-dashboard y file-storage para exportar y borrar.

## Criterios de aceptación

- **CA-GDPR-01** — Dada una organización con respuestas y fotos, cuando se ejecuta el script de borrado, entonces no queda ninguna fila ni archivo con su `organizationId`.
- **CA-GDPR-02** — Dada una respuesta recibida, cuando se revisan los logs del servidor, entonces no aparece ningún valor de la respuesta.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
