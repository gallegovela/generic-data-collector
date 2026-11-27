# Privacidad y RGPD

- **Prefijo:** `GDPR`
- **Estado:** borrador
- **Responsable:** analyst-programmer (escribe), architect (revisa)

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
| RF-GDPR-04 | Should | El formulario público muestra un texto informativo de protección de datos configurable por organización. **Precisado en #38:** se resuelve con los enlaces a términos y privacidad que el administrador configura al publicar cada formulario (RF-PUB-12) y con el aviso del responsable (RF-GDPR-06); no hay un texto único por organización. |
| RF-GDPR-05 | Could | Un formulario puede tener un plazo de conservación tras el cual sus respuestas se borran. |
| RF-GDPR-06 | Must | Reparto de papeles documentado en [processor-role.md](processor-role.md): la organización cliente es **responsable del tratamiento** de las respuestas y FormIA su **encargado**. Un formulario `public` muestra a quien rellena quién es el responsable (nombre de la organización) y que FormIA actúa como encargado. (#38) |
| RF-GDPR-07 | Must | Publicar un formulario `public` exige que el administrador declare, con una casilla, que los términos y la política enlazados son los de su organización, que es responsable del tratamiento y que acepta el contrato de encargo; la declaración queda registrada (quién y cuándo) en la versión del formulario. (#38; la mecánica está en `form-publishing`, RF-PUB-12) |
| RF-GDPR-08 | Must | La prueba de aceptación de términos de cada respuesta (`Submission.consent`) se conserva, exporta y borra **junto con su respuesta**: entra en la exportación completa (RF-GDPR-01), se borra con la respuesta (RF-GDPR-03), con la caducidad (RF-GDPR-05, #24) y con el borrado de la organización (RF-GDPR-02). No se guarda prueba de aceptación sin respuesta. (#38) |

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
- **CA-GDPR-03** — Dado un formulario `public` publicado con términos, cuando una persona anónima abre `/f/<slug>`, entonces ve el nombre de la organización como responsable, la mención de FormIA como encargado y los enlaces a los términos y la privacidad. (#38; **diferido**: depende de la pantalla de relleno de #33, se desarrolla y se prueba en la pieza posterior de `field-collector`; #38 solo deja disponibles `consent` y `organizationName` en la lectura, CA-PUB-11)
- **CA-GDPR-04** — Dada una respuesta con prueba de aceptación, cuando se borra la respuesta, entonces desaparece también su `consent` (está en la misma fila); y la declaración del administrador solo existe en `FormVersion.consent`, que se borra con la organización. (#38; el borrado de respuesta y de organización se verifican cuando existan RF-GDPR-02 y RF-GDPR-03; hoy solo se comprueba que `consent` es una columna de `Submission`, PP-SUB-20)

## Historial de cambios

- 2026-11-14 — Creación del módulo.
- 2026-11-27 — Issue #38: RF-GDPR-06 a RF-GDPR-08, CA-GDPR-03 y CA-GDPR-04; RF-GDPR-04 precisado; nuevo documento [processor-role.md](processor-role.md).
