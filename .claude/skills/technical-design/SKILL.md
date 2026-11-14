---
name: technical-design
description: Cómo convertir una pieza funcional en un diseño técnico para el stack de FormIA (Next.js App Router, Prisma, Zod, Dexie) y desglosarlo en tareas de código - capas, nombres de ficheros, contratos, modelo de datos, estrategia de tests y tamaño de tareas. Úsala al escribir specs/<modulo>/design.md o issues "development".
---

# Diseño técnico y desglose en tareas

## Capas y dónde va cada cosa

| Capa | Ruta | Responsabilidad | Equivalente clásico |
| --- | --- | --- | --- |
| Página / UI | `src/app/(admin)/**/page.tsx`, `src/app/f/[slug]/**` | Componer componentes, cargar datos con el servicio | Vista |
| Componentes | `src/components/<modulo>/*.tsx`, `src/components/ui/*` (shadcn) | Presentación, sin lógica de negocio | Vista |
| Hooks cliente | `src/hooks/use-*.ts` | Estado y efectos en el cliente | — |
| Entrada HTTP | `src/app/api/**/route.ts` | Autenticar, validar con Zod, llamar al servicio, mapear errores a HTTP | Controlador |
| Server actions | `src/server/<modulo>/<modulo>.actions.ts` | Igual que un route handler, para formularios del panel | Controlador |
| Esquemas | `src/lib/<modulo>/<modulo>.schema.ts` | Zod compartido cliente/servidor; tipos con `z.infer` | DTO |
| Servicio | `src/server/<modulo>/<modulo>.service.ts` | Reglas de negocio, orquestación, transacciones | Servicio |
| Repositorio | `src/server/<modulo>/<modulo>.repository.ts` | Consultas Prisma; **todas** reciben `organizationId` | DAO |
| Modelo | `prisma/schema.prisma` + migración | Tablas, índices, relaciones | Entidad |
| Integraciones | `src/server/integrations/<proveedor>.ts` | S3/Blob, SMTP, Anthropic, webhooks | Adaptador |
| Lógica pura | `src/lib/<modulo>/*.ts` | Funciones sin E/S (lógica condicional, mapeos) | Utilidad de dominio |
| Sin conexión | `src/lib/offline/*.ts` | Dexie, cola de envío, sincronización | — |
| Tests | junto al fichero `*.test.ts`; e2e en `e2e/*.spec.ts` | Vitest / Playwright | — |

Si el proyecto ya tiene otra convención en el código, sigue la del código y documéntala en `design.md`.

## Pasos

1. **Leer** requisitos (`README.md`), diseño existente y código relacionado.
2. **Modelo de datos**: entidades y campos nuevos, índices (siempre con `organizationId` primero), restricciones únicas (por ejemplo `@@unique([organizationId, clientId])`), migración necesaria.
3. **Contratos**:
   - Endpoints: método, ruta, autenticación y rol, cuerpo (esquema Zod), respuestas con código HTTP, errores.
   - Servicios y repositorios: firma TypeScript completa.
   - Eventos o efectos (email, webhook): cuándo se disparan y con qué carga.
4. **Flujo**: diagrama de secuencia Mermaid para los flujos con más de dos capas.
5. **Errores**: tabla de errores de dominio → código HTTP → mensaje en español para la interfaz.
6. **Seguridad**: comprobación de rol, filtro por organización, validación de entrada, URLs firmadas, nada de datos personales en logs.
7. **Tests**: para cada `CA-<MOD>-NN`, qué test lo cubre y de qué tipo.
8. **Desglose** en tareas `development`.

## Reglas para desglosar tareas

- Una tarea = un cambio que se puede programar, probar y revisar por separado: idealmente menos de un día y de 2 a 8 ficheros.
- Orden habitual: modelo y migración → esquemas Zod → repositorio → servicio → entrada HTTP / actions → interfaz → e2e.
- Las tareas de lógica pura (sin E/S) van primero: son las más fáciles de probar.
- Cada tarea indica sus dependencias y deja el proyecto compilando y con los tests en verde.
- Nada de tareas tipo "hacer el backend": tienen que nombrar ficheros y funciones.
- Incluye siempre la tarea de datos de ejemplo (`prisma/seed.ts`) si la funcionalidad aparece en la demo.

## Calidad del diseño

- [ ] El programador no tiene que decidir nombres, firmas ni estructura.
- [ ] Cada criterio de aceptación tiene al menos un test asignado.
- [ ] Ninguna consulta sin `organizationId`.
- [ ] Reutiliza `form-schema` y utilidades existentes en lugar de duplicarlas.
- [ ] Ninguna dependencia nueva sin justificar.
