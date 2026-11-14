# API pública

- **Prefijo:** `API`
- **Estado:** borrador
- **Dueño de los requisitos:** architect

## Objetivo

Permitir a los sistemas del cliente consultar sus formularios y respuestas mediante una API REST de solo lectura, autenticada con claves por organización.

## Alcance

**Incluido**
- Gestión de `ApiKey` desde el panel.
- Endpoints de solo lectura de formularios, versiones y respuestas.
- Documentación OpenAPI.

**Fuera de alcance**
- Escritura por API, OAuth, webhooks entrantes.

## Requisitos funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RF-API-01 | Must | Un administrador puede crear, nombrar y revocar claves de API de su organización. |
| RF-API-02 | Must | La clave completa solo se muestra una vez al crearla; se guarda únicamente su hash. |
| RF-API-03 | Must | La API se autentica con la cabecera `Authorization: Bearer <clave>`. |
| RF-API-04 | Must | `GET /api/v1/forms` y `GET /api/v1/forms/{id}` devuelven los formularios y su versión publicada. |
| RF-API-05 | Must | `GET /api/v1/forms/{id}/submissions` devuelve respuestas paginadas por cursor, filtrables por fecha (`since`, `until`). |
| RF-API-06 | Must | `GET /api/v1/submissions/{id}` devuelve una respuesta con URLs firmadas de sus archivos. |
| RF-API-07 | Must | Existe un documento OpenAPI 3 en `/api/v1/openapi.json`. |
| RF-API-08 | Should | Se registra la fecha de último uso de cada clave. |

## Requisitos no funcionales

| ID | Prioridad | Requisito |
| --- | --- | --- |
| RNF-API-01 | Must | Una clave solo da acceso a datos de su organización. |
| RNF-API-02 | Should | Límite de 60 peticiones por minuto por clave; se responde 429 al superarlo. |
| RNF-API-03 | Must | Errores en JSON con formato uniforme `{ error: { code, message } }`. |

## Dependencias

- Depende de: tenancy-auth, form-publishing, submissions-dashboard, file-storage.

## Criterios de aceptación

- **CA-API-01** — Dada una clave revocada, cuando se usa, entonces la API responde 401.
- **CA-API-02** — Dada una clave de la organización A, cuando se pide una respuesta de la organización B, entonces la API responde 404.

## Historial de cambios

- 2026-11-14 — Creación del módulo.
