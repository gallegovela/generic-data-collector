# Papel de FormIA: encargado del tratamiento

- **Requisitos:** RF-GDPR-06, RF-GDPR-07, RF-GDPR-08 en [README.md](README.md)
- **Responsable:** analyst-programmer (escribe), architect (revisa)
- **Issues:** #38

> Este documento describe el reparto de papeles y lo que hace la plataforma. **No es asesoramiento jurídico ni el texto del contrato**: el texto definitivo del contrato de encargo (art. 28 RGPD) y el del aviso lo tiene que revisar una persona con formación legal antes de ofrecer FormIA a clientes reales.

## Reparto de papeles

| Quién | Papel | Qué decide |
| --- | --- | --- |
| Organización cliente (la que crea el formulario) | **Responsable del tratamiento** | Qué datos se piden, para qué, durante cuánto tiempo, a quién se envían y qué texto legal (términos y política de privacidad) se muestra. |
| FormIA (la plataforma) | **Encargado del tratamiento** | Aloja, almacena y entrega las respuestas siguiendo las instrucciones del responsable; no las usa para otros fines. |
| Persona que rellena el formulario | Interesada | Recibe la información y acepta los términos del responsable. |

## Qué hace la plataforma (traza a requisitos)

| Obligación | Cómo se cumple | Requisito |
| --- | --- | --- |
| Informar a quien rellena | `/f/<slug>` en modo `public` muestra el responsable (nombre de la organización), la mención de FormIA como encargado y los enlaces a los términos y la privacidad del responsable. | RF-GDPR-06 (la pantalla de relleno es una pieza posterior de `field-collector`, tras #33; #38 expone los datos) |
| Obtener y poder probar la aceptación | Casilla obligatoria al guardar (pieza posterior de `field-collector`); se guarda fecha del servidor, enlaces y versión en `Submission.consent` (#38 deja listo el almacenamiento). | RF-SUB-13 |
| El responsable asume su papel | El administrador declara al publicar (casilla) y queda registrado quién y cuándo en `FormVersion.consent`. | RF-GDPR-07, RF-PUB-12, RF-PUB-13 |
| Contrato de encargo | Texto a redactar por una persona con formación legal (ver "Pendiente"). La declaración del administrador hace referencia a él. | RF-GDPR-07 |
| Alojamiento en la UE, logs sin datos personales, archivos privados | Reglas transversales del README. | RNF-GDPR-01 a RNF-GDPR-03 |
| Acceso, exportación y supresión | Exportación completa y borrado de una organización (scripts), borrado de una respuesta. La prueba de aceptación sigue a su respuesta. | RF-GDPR-01 a RF-GDPR-03, RF-GDPR-08 |
| Plazo de conservación | Lo decide el responsable (RF-GDPR-05, housekeeper #24). Al caducar la respuesta se borra su `consent`. | RF-GDPR-05, RF-GDPR-08 |

## Subencargados previstos (a confirmar)

Proveedores a los que FormIA puede transmitir datos, para listarlos en el contrato: alojamiento (Azure, UE), almacenamiento de archivos (S3 compatible / Azure Blob, UE), correo (SMTP: Brevo u otro) y, solo con definiciones de formularios y nunca con respuestas, la API de Anthropic (RNF-GDPR-04). La lista final y su ubicación las confirma el responsable del producto.

## Pendiente (fuera de #38)

- Redactar el contrato de encargo y decidir dónde se publica (página dentro de la plataforma o documento aparte). Hasta entonces la declaración del administrador lo menciona sin enlazarlo.
- Registro de actividades de tratamiento y portal de derechos: fuera de alcance del piloto (README).

## Historial de cambios

- 2026-11-27 — Documento inicial (#38): reparto de papeles, trazabilidad a requisitos y pendientes legales.
