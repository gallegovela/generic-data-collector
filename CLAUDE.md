# CLAUDE.md

Guía del proyecto para Claude Code. Léela antes de cualquier tarea.

## Qué es el proyecto

**Nombre provisional:** FormIA

Plataforma SaaS para crear formularios de recogida de datos, pensada para pymes y autónomos que todavía usan papel, Excel o WhatsApp: partes de obra, inspecciones, pedidos en ruta, encuestas de satisfacción o recogida de documentación de clientes.

Qué la diferencia de Google Forms, Jotform o Kizeo:

- **Asistente de IA**: crea el formulario a partir de una descripción en lenguaje natural o de una foto del formulario en papel.
- **Personalización completa**: logo, colores, tipografía y estilo de cada cliente.
- **Uso en campo**: funciona sin conexión y recoge fotos, firma y GPS.
- **Varias salidas para los datos**: email, exportación a Excel, CSV o PDF, fichas en un panel online, webhooks y API.
- **Datos bajo control**: alojamiento en la UE, cumplimiento del RGPD y posibilidad de instalación privada.

## Objetivo actual: piloto de demostración

Lo que se construye ahora es un **piloto para enseñar a posibles clientes**, no el producto definitivo. Prioridades, en este orden:

1. Que la demostración funcione de principio a fin sin fallos.
2. Que tenga buen aspecto visual.
3. Que el código sea simple y fácil de cambiar.

No sobredimensionar: nada de microservicios, colas ni multirregión en esta fase.

### Recorrido de la demo (el camino que tiene que funcionar siempre)

1. El administrador entra y crea un formulario:
   - describiéndolo con el asistente de IA ("parte diario de obra con fotos y firma del encargado"), o
   - subiendo una foto de un formulario en papel.
2. Ajusta el formulario en el editor visual: campos, orden, obligatorios, logo y colores.
3. Lo publica y obtiene un enlace o un código QR.
4. Un trabajador lo rellena desde el móvil, también sin conexión, con foto, firma y GPS.
5. La respuesta aparece como ficha en el panel, llega por email en PDF y se puede exportar a Excel.

## Alcance del piloto

**Incluido**
- Editor de formularios con arrastrar y soltar.
- Tipos de campo: texto, número, fecha y hora, selección única o múltiple, sí/no, foto, firma, GPS, sección o título.
- Lógica condicional básica: mostrar u ocultar un campo según otra respuesta.
- Tema por organización: logo, color principal, color secundario, tipografía.
- Asistente de IA para crear y modificar formularios.
- Aplicación web instalable (PWA) para rellenar formularios, con modo sin conexión y sincronización al recuperar la red.
- Panel de respuestas: listado, ficha de detalle y filtros.
- Salidas: email con PDF, exportación a Excel y CSV, webhook por formulario.
- API REST básica de solo lectura para consultar respuestas.
- Varias organizaciones en la misma instalación (multi-tenant sencillo).

**Fuera de alcance por ahora**
- Pagos y suscripciones.
- Apps nativas para iOS o Android.
- Inicio de sesión corporativo (SSO).
- Flujos de aprobación con varios pasos.
- Integraciones con ERP o software de contabilidad concretos.

## Stack técnico

Decisiones iniciales; se pueden cambiar si hay un buen motivo, pero hay que hablarlo antes.

| Capa | Tecnología |
| --- | --- |
| Frontend y backend | Next.js (App Router) + TypeScript |
| Interfaz | Tailwind CSS + shadcn/ui |
| Editor de formularios | dnd-kit |
| Modo sin conexión | PWA (service worker) + IndexedDB con Dexie |
| Base de datos | PostgreSQL; definición de formularios y respuestas en JSONB |
| ORM | Prisma |
| Autenticación | Auth.js (email + contraseña o enlace mágico) |
| Archivos (fotos, firmas, logos) | Almacenamiento compatible con S3 (MinIO en local, Azure Blob en la nube) |
| IA | API de Anthropic (Claude) con salida JSON validada |
| Validación | Zod (un mismo esquema en cliente y servidor) |
| PDF | Generación en el servidor (react-pdf o similar) |
| Excel | exceljs |
| Email | SMTP (Brevo u otro proveedor) |
| Despliegue | Docker + docker-compose en local; Azure (contenedores) para la demo pública |

## Arquitectura y modelo de datos

La pieza central es el **esquema del formulario**: un JSON versionado que describe campos, lógica y tema. Ese mismo JSON lo usan el editor, el asistente de IA, el renderizador del móvil, el PDF y la exportación.

Entidades principales:

- `Organization`: cliente (tenant), con su tema visual.
- `User`: pertenece a una organización; rol `admin` o `collector`.
- `Form`: nombre, estado (`draft` o `published`) y versión publicada actual.
- `FormVersion`: esquema JSON inmutable. Cada publicación crea una versión nueva y las respuestas apuntan a la versión con la que se rellenaron.
- `Submission`: respuestas en JSONB, metadatos (dispositivo, GPS, fecha de captura y de sincronización) y referencias a archivos.
- `Destination`: salidas configuradas por formulario (email, webhook).
- `ApiKey`: claves de la API por organización.

Reglas:

- Toda consulta se filtra por `organizationId`. Nunca debe haber datos de una organización visibles para otra.
- El esquema del formulario se define una sola vez con Zod en `packages/form-schema` (o `src/lib/form-schema`) y se reutiliza en todas partes.
- Cada respuesta lleva un `clientId` (UUID generado en el dispositivo) para que la sincronización sin conexión no cree duplicados.

## Asistente de IA

- La IA **nunca escribe directamente en la base de datos**. Devuelve un esquema JSON que se valida con Zod y se muestra al usuario como borrador para que lo revise.
- Entradas admitidas: texto libre, foto de un formulario en papel, o "modifica este formulario" junto con el esquema actual.
- Si la respuesta no pasa la validación, se reintenta una vez con el error incluido en el prompt; si vuelve a fallar, se muestra un error claro.
- Los prompts viven en `src/lib/ai/prompts/` y se versionan como código.
- No enviar a la IA datos de respuestas de clientes; solo definiciones de formularios.

## Datos personales y RGPD

- Alojamiento en la UE.
- No registrar en los logs contenido de las respuestas ni datos personales.
- Fotos y firmas siempre en almacenamiento privado, con URLs firmadas de corta duración.
- Exportar y borrar todos los datos de una organización tiene que ser posible (aunque en el piloto sea un script).
- Los secretos, en variables de entorno; nunca en el repositorio. Mantener `.env.example` al día.

## Convenciones

- Código, nombres de variables y commits en **inglés**. Textos de la interfaz en **español**, preparados para traducirse más adelante (i18n).
- TypeScript en modo `strict`, sin `any` salvo justificación.
- Componentes pequeños; lógica de negocio fuera de los componentes, en `src/lib/` o `src/server/`.
- Diseño pensado primero para móvil: el formulario se rellena en el móvil y el panel se usa sobre todo en ordenador.
- Commits con Conventional Commits (`feat:`, `fix:`, `chore:`…).
- Antes de dar una tarea por terminada: el código compila, pasa el linter y pasan los tests.

## Tests

- Vitest para la lógica: validación de esquemas, lógica condicional, exportaciones, generación del PDF.
- Playwright para el recorrido de la demo completo, incluido el modo sin conexión.
- Cualquier cambio en el esquema del formulario debe ir acompañado de tests.

## Comandos

Pendientes de crear al inicializar el proyecto. Objetivo:

```bash
docker compose up -d      # PostgreSQL, MinIO y Mailpit en local
npm run dev               # servidor de desarrollo
npm run lint              # linter
npm run typecheck         # comprobación de tipos
npm test                  # tests unitarios
npm run test:e2e          # tests de extremo a extremo
npm run db:migrate        # migraciones de Prisma
npm run db:seed           # datos de ejemplo para la demo
```

## Datos de ejemplo para la demo

El seed debe crear una organización de ejemplo con su logo y colores, y tres formularios listos para enseñar:

1. Parte diario de obra (fotos, firma, GPS).
2. Encuesta de satisfacción de cliente.
3. Alta de cliente para gestoría (datos personales y documentos).

Incluir algunas respuestas de ejemplo para que el panel no se vea vacío.

## Primeros pasos sugeridos

1. Crear el proyecto Next.js con TypeScript, Tailwind, Prisma y docker-compose.
2. Definir el esquema del formulario con Zod y escribir sus tests.
3. Hacer el renderizador del formulario en móvil a partir del esquema.
4. Hacer el editor visual.
5. Añadir el asistente de IA.
6. Añadir el modo sin conexión y la sincronización.
7. Añadir las salidas: panel, PDF por email, Excel y webhook.
8. Preparar el seed de la demo y los tests de Playwright.

