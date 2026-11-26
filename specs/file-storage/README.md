# Almacenamiento de archivos

- **Prefijo:** `STO`
- **Estado:** diseñado (alcance de #25: fotos, firmas y documentos; el logo de `theming` y la subida pública quedan fuera)
- **Responsable:** analyst-programmer (escribe), architect (revisa)

## Objetivo

Guardar de forma privada y segura fotos, firmas, logos y documentos, con una interfaz única compatible con S3 (MinIO en local, Azure Blob en la nube).

## Alcance

**Incluido**
- Adaptador de almacenamiento con implementación S3/MinIO y Azure Blob.
- Subida de archivos desde la PWA (también diferida tras el modo sin conexión).
- URLs firmadas de corta duración para ver y descargar.
- Organización de claves por organización.

**Fuera de alcance**
- Procesado de vídeo, antivirus (se anota como mejora).

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-STO-01 | Must | Los archivos se guardan con claves `org/<organizationId>/<tipo>/<uuid>.<ext>`. |
| RF-STO-02 | Must | El acceso a un archivo solo es posible mediante URL firmada que caduca en 15 minutos o menos. |
| RF-STO-03 | Must | Solo se generan URLs firmadas para archivos de la organización del solicitante. |
| RF-STO-04 | Must | Se admiten imágenes JPG, PNG, WEBP y HEIC (fotos), PNG (firmas) y PDF (documentos), con tamaño máximo configurable (10 MB por defecto). |
| RF-STO-05 | Should | Las fotos se reducen en el dispositivo a un máximo de 2048 px de lado antes de subirse. |
| RF-STO-06 | Must | Una subida es idempotente: reintentar la misma subida no crea un archivo duplicado. |
| RF-STO-07 | Should | Los archivos huérfanos (sin respuesta asociada tras 7 días) se pueden borrar con un script. En #25 solo se implementa el criterio de "huérfano" (consulta en el repositorio); el script de borrado lo hace #24 (`privacy-gdpr`). |
| RF-STO-08 | Must | En la respuesta (JSONB) solo se guarda la **clave** del archivo, nunca una URL. La clave se resuelve a una URL firmada en el momento de pedirla (#25). |
| RF-STO-09 | Must | Existe una ruta autenticada `GET /api/files?key=<clave>` que, si la clave es de la organización de la sesión, responde con una redirección a una URL firmada de vida corta (#25). |
| RF-STO-10 | Must | Existe una ruta autenticada `POST /api/files` que sube un archivo, comprueba su tipo real (por su contenido, no por la extensión ni el `Content-Type` declarado) y su tamaño, y registra sus metadatos en la tabla `StoredFile` (#25). La subida anónima de un formulario público la añadirá `field-collector` reutilizando el mismo servicio. |
| RF-STO-11 | Must | Todo archivo subido queda registrado con organización, tipo, tamaño y fecha, y con una referencia opcional a la respuesta, para localizar huérfanos y borrar por organización (#25). |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-STO-01 | Must | Los contenedores o buckets son privados; nunca acceso público. |
| RNF-STO-02 | Must | Almacenamiento alojado en la UE. |
| RNF-STO-03 | Must | Cambiar de MinIO a Azure Blob solo requiere variables de entorno. |
| RNF-STO-04 | Must | Los logs del módulo registran solo claves y tamaños, nunca el contenido de los archivos (RGPD). |

## Dependencias

- Depende de: platform, tenancy-auth.
- Lo usan: field-collector, theming, submissions-dashboard, outputs, privacy-gdpr.

## Criterios de aceptación

- **CA-STO-01** — Dada una URL firmada de una foto, cuando han pasado más de 15 minutos, entonces la URL devuelve acceso denegado.
- **CA-STO-02** — Dado un administrador de la organización A, cuando pide la URL de un archivo de la organización B, entonces recibe 404.
- **CA-STO-03** — Dada una imagen subida, cuando un usuario de su organización pide la ruta de acceso, entonces recibe una redirección a una URL firmada que caduca en 15 minutos o menos.
- **CA-STO-04** — Dado un archivo con tipo no admitido o más grande que el máximo, cuando se sube, entonces se rechaza sin guardar nada (ni en el almacenamiento ni en la base de datos).
- **CA-STO-05** — Dada la misma subida repetida con el mismo identificador, entonces solo existe un archivo.

## Historial de cambios

- 2026-11-26 — RF-STO-08 a RF-STO-11, RNF-STO-04, CA-STO-03 a CA-STO-05; RF-STO-07 acotado; estado "diseñado" (#25).
- 2026-11-14 — Creación del módulo.
