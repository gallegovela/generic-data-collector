# ADR — Ficheros por correo y tamaño máximo del PDF

- **Módulo:** [outputs](README.md) (con efecto en `admin-settings`, #40)
- **Estado:** propuesta, pendiente de aprobación del arquitecto
- **Issue:** #37 (estudio; padre #23)
- **Responsable:** analyst-programmer (escribe), architect (revisa)

Este documento es un estudio: **no cambia ningún requisito numerado todavía**. Si se aprueba, el arquitecto crea las dos piezas de la sección «Piezas derivadas» y los requisitos propuestos pasan a `README.md` con su numeración definitiva.

## Contexto

- #35 (`outputs`) envía por email el PDF de cada respuesta. Su RF-OUT-17 ya fija un tope del adjunto `EMAIL_MAX_ATTACHMENT_BYTES` (10 MB por defecto) y, si se supera, genera el PDF sin imágenes con un aviso y un enlace a la ficha autenticada.
- #40 (`admin-settings`) define `Plan.maxFileBytes` (tamaño máximo **por archivo subido**, RF-SET-12; 10 MB en el plan «Genérico») y el tope técnico `STORAGE_MAX_UPLOAD_BYTES`.
- RF-STO-02 prohíbe URLs firmadas de larga duración. RNF-GDPR exige que fotos y firmas estén en almacenamiento privado.

## Hechos que condicionan la decisión

1. **El correo no es un canal privado ni controlado.** Una vez enviado, el adjunto queda en servidores intermedios, buzones y copias del destinatario. Eso ya ocurre con el PDF (el administrador es responsable de elegir destinatarios, #35); enviar además los ficheros originales multiplica el dato personal expuesto.
2. **El tamaño real del mensaje es mayor que el del adjunto.** MIME codifica en base64, lo que añade aproximadamente un 37 % (4/3 más saltos de línea). Un adjunto de 10 MB produce un mensaje de unos 13,7 MB.
3. **Los límites típicos del correo** están entre 10 y 25 MB por mensaje (Gmail 25 MB, Outlook/Microsoft 365 20 MB por defecto, muchos servidores corporativos 10 MB), y los proveedores SMTP transaccionales suelen poner el suyo, a veces más bajo. El límite exacto de Brevo debe **verificarse en su documentación y en la cuenta contratada** antes de fijar el valor por defecto; este ADR no lo da por conocido.
4. **El límite por plan no protege el correo.** `Plan.maxFileBytes` acota cada archivo; una respuesta puede llevar muchos (hasta 12 imágenes entran en el PDF, #35), así que la suma puede superar el tope del correo aunque cada archivo cumpla el plan.
5. Un rechazo por tamaño es normalmente **permanente** (5xx, p. ej. 552 / 554): reintentarlo no sirve.

## Opciones evaluadas

| Opción | Pros | Contras | Veredicto |
| --- | --- | --- | --- |
| **A. PDF sin imágenes + enlace autenticado a la ficha** (ya en #35) | Sin datos nuevos en el correo; el enlace exige sesión; sin cambios de infraestructura. | El destinatario sin cuenta no ve las fotos. | **Adoptar como degradación por defecto.** |
| **B. Reducir imágenes** (re-escalar y recomprimir JPEG antes de incrustar) | Mantiene las fotos en el PDF; casi siempre basta para bajar de 10 MB. | Necesita procesar imágenes (dependencia como `sharp`); coste de CPU; pérdida de calidad. | **Recomendado como primer paso, solo si se aprueba la dependencia** (ver pregunta 2). Sin ella, se pasa directo a A. |
| **C. Enlace autenticado en vez de adjunto** | Correo siempre pequeño. | El destinatario necesita cuenta en la organización; cambia el caso de uso (el PDF adjunto es una promesa del producto, RF-OUT-02). | Solo como último escalón si ni el PDF sin imágenes cabe. |
| **D. Dividir en varios correos** | Entrega todo. | Más ruido, orden no garantizado, más datos personales dispersos, más fallos parciales, estado de entrega más complejo. | **Descartada.** |
| **E. Adjuntar los ficheros originales** | El destinatario recibe todo. | Multiplica el tamaño, expone fotos y firmas en un canal no privado, choca con RNF-GDPR. | **Descartada.** |
| **F. Enlace firmado de larga duración a los originales** | Correo pequeño con acceso directo. | Incumple RF-STO-02; un reenvío del correo da acceso a quien lo reciba. | **Descartada.** |

## Recomendación

1. **Un único adjunto: el PDF.** Nunca se envían ficheros originales por correo (descarta E y F). El correo lleva, como mucho, un enlace a la ficha autenticada.
2. **Degradación en escalera** al generar el PDF de un correo (la `maxBytes` es el tope del adjunto, ver punto 3):
   1. PDF con imágenes. Si cabe, se envía.
   2. Reducir imágenes (B), si se aprueba la dependencia: se reescalan a un lado largo máximo (propuesta: 1280 px) y calidad JPEG 70. Si cabe, se envía con un aviso corto.
   3. PDF sin imágenes con aviso y enlace a la ficha (A, ya en #35).
   4. Si ni siquiera el PDF sin imágenes cabe (respuesta con muchísimo texto), el envío pasa a `failed` con el código `ATTACHMENT_TOO_LARGE` **sin reintentos**, y no se adjunta nada: se envía un correo breve con solo el enlace a la ficha (C). Es la única situación en la que C se usa.
3. **El tope se expresa sobre el mensaje, no sobre el adjunto.** Propuesta: variable `SMTP_MAX_MESSAGE_BYTES` (límite del proveedor, por defecto 10 MB hasta verificar el de Brevo) y tope efectivo del adjunto = `floor(SMTP_MAX_MESSAGE_BYTES / 1,37)`, menos un margen fijo de 200 KB para cabeceras y cuerpo. Sustituye a `EMAIL_MAX_ATTACHMENT_BYTES` (que con 10 MB daría un mensaje de unos 13,7 MB, por encima de lo que muchos servidores aceptan). Se evita así tener dos variables incoherentes.
4. **Relación con el plan (`admin-settings`).** El tope del correo **no** pasa a ser un límite del plan: es una propiedad técnica del proveedor SMTP, común a todas las organizaciones, y por eso va en variables de entorno. El plan solo limita el tamaño por archivo subido (RF-SET-12). Lo que sí se aprovecha del plan es informar: la pantalla de planes puede mostrar un aviso («un PDF con muchas fotos puede enviarse sin imágenes, ver tope de correo») y, como mejora opcional, `maxFileBytes` no debería fijarse por encima del tope técnico `STORAGE_MAX_UPLOAD_BYTES` (ya garantizado por RF-SET-12).
5. **Reintentos.** Un fallo de tamaño detectado **antes** de enviar (el PDF no cabe) es permanente: `failed` directo, sin reintentos. Un rechazo SMTP posterior por tamaño (código de respuesta 552 o 554, o 5xx con texto de tamaño) también se trata como permanente: `failed` con código `SMTP_TOO_LARGE`, sin reintentos. El resto de 5xx y los 4xx siguen la política de #35. Resultado: se evita gastar los 5 intentos de RF-OUT-09 en un fallo que no se arregla solo. El administrador ve el motivo en el historial de envíos (RF-OUT-10), no el contenido.
6. **RGPD.** El adjunto es el PDF, que ya contiene datos personales: se mantiene el aviso de #35 y se añade a la pantalla de destinos que el correo no es un canal privado y que, por eso, nunca incluye ficheros originales ni enlaces firmados. Los logs de tamaño registran solo bytes y códigos, nunca contenido (RNF-OUT-05).

## Piezas derivadas (si se aprueba)

### Pieza de `outputs` (tras fusionar #35)

Requisitos propuestos (numeración provisional, el arquitecto la confirma al mover a `README.md`):

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-OUT-19 | Must | El tope del adjunto se deriva de `SMTP_MAX_MESSAGE_BYTES` teniendo en cuenta la codificación base64 y un margen fijo; sustituye a `EMAIL_MAX_ATTACHMENT_BYTES`. |
| RF-OUT-20 | Should | Si el PDF con imágenes supera el tope, se intenta reducir las imágenes antes de quitarlas (sujeto a aprobar la dependencia). |
| RF-OUT-21 | Must | Si el PDF sin imágenes supera el tope, el envío falla sin reintentos con el código `ATTACHMENT_TOO_LARGE` y se envía un correo con solo el enlace a la ficha. |
| RF-OUT-22 | Must | Un rechazo SMTP por tamaño (552 / 554) es un fallo permanente (`SMTP_TOO_LARGE`): no se reintenta. |
| RF-OUT-23 | Must | Nunca se adjuntan ni se enlazan con URL firmada los ficheros originales en un correo. |

Criterios de aceptación propuestos: CA-OUT-14 (PDF que solo cabe tras reducir imágenes → se envía con imágenes reducidas), CA-OUT-15 (PDF que no cabe ni sin imágenes → `failed` con `ATTACHMENT_TOO_LARGE`, 1 solo intento, correo de solo enlace), CA-OUT-16 (SMTP que responde 552 → `failed` con `SMTP_TOO_LARGE`, 1 solo intento).

Cambios de diseño: `src/server/outputs/pdf.ts` recibe la `maxBytes` calculada y la escalera; `EMAIL_MAX_ATTACHMENT_BYTES` se retira de `getEnv` y de `.env.example` y se añade `SMTP_MAX_MESSAGE_BYTES`; el clasificador de errores de `delivery.service.ts` añade los dos códigos como no reintentables.

### Pieza de `admin-settings` (tras fusionar #40)

Cambio pequeño y opcional: texto informativo en `/admin/settings/plans` junto a «tamaño máximo de archivo» que explique que el correo tiene su propio tope técnico, y comprobación de que `maxFileBytes` mostrado no supera `STORAGE_MAX_UPLOAD_BYTES`. No añade columnas ni límites al modelo `Plan`.

## Riesgos

- El valor real del límite de Brevo puede ser menor que 10 MB: hay que verificarlo antes de desplegar; con `SMTP_MAX_MESSAGE_BYTES` basta cambiar una variable.
- Reescalar imágenes con `sharp` añade una dependencia nativa a la imagen Docker: de ahí que sea opcional y requiera aprobación.
- Clasificar errores SMTP por código es heurístico: un 552 es casi siempre tamaño o cuota; si otro proveedor usa otro código, el envío seguiría la política de reintentos normal (fallo seguro).

## Historial de cambios

- 2026-11-27 — Creación del estudio (#37): opciones evaluadas, recomendación y piezas derivadas para `outputs` y `admin-settings`.
