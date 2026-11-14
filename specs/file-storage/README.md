# Almacenamiento de archivos

- **Prefijo:** `STO`
- **Estado:** borrador
- **Dueño de los requisitos:** architect

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
| RF-STO-07 | Should | Los archivos huérfanos (sin respuesta asociada tras 7 días) se pueden borrar con un script. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-STO-01 | Must | Los contenedores o buckets son privados; nunca acceso público. |
| RNF-STO-02 | Must | Almacenamiento alojado en la UE. |
| RNF-STO-03 | Must | Cambiar de MinIO a Azure Blob solo requiere variables de entorno. |

## Dependencias

- Depende de: platform, tenancy-auth.
- Lo usan: field-collector, theming, submissions-dashboard, outputs, privacy-gdpr.

## Criterios de aceptación

- **CA-STO-01** — Dada una URL firmada de una foto, cuando han pasado más de 15 minutos, entonces la URL devuelve acceso denegado.
- **CA-STO-02** — Dado un administrador de la organización A, cuando pide la URL de un archivo de la organización B, entonces recibe 404.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
