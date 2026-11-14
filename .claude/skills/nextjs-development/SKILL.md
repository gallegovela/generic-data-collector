---
name: nextjs-development
description: Estándares de programación de FormIA para Next.js App Router + TypeScript estricto, Prisma, Zod, Tailwind + shadcn/ui, Dexie, Vitest y Playwright - estructura, patrones de código, manejo de errores, tests, commits y definición de hecho. Úsala al implementar cualquier tarea de código.
---

# Desarrollo en el stack de FormIA

## TypeScript

- `strict` activado. Prohibido `any`; usa `unknown` y estrecha el tipo. Si es inevitable, comenta por qué.
- Tipos derivados de Zod: `type FormSchema = z.infer<typeof formSchema>`. No dupliques tipos a mano.
- Funciones pequeñas, nombres descriptivos en inglés, `async/await`, sin efectos en el nivel superior de los módulos.
- Exporta solo lo que otros módulos usan.

## Patrones por capa

Route handler (controlador):

```ts
export async function POST(req: Request) {
  const session = await requireSession({ role: "admin" });
  const parsed = createFormInput.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const form = await formService.create(session.organizationId, parsed.data);
  return Response.json(form, { status: 201 });
}
```

Repositorio (DAO): toda función recibe `organizationId` como primer parámetro y lo incluye en el `where`.

```ts
export function findFormById(organizationId: string, id: string) {
  return prisma.form.findFirst({ where: { id, organizationId } });
}
```

Servicio: lógica de negocio, lanza errores de dominio (`NotFoundError`, `ValidationError`, `ForbiddenError`) que la capa de entrada traduce a HTTP. No conoce `Request` ni `Response`.

Componentes: Server Components por defecto; `"use client"` solo cuando haya interacción. Usa los componentes de shadcn/ui de `src/components/ui`. Diseño móvil primero con Tailwind. Textos visibles en español y centralizados para i18n (no dispersos en la lógica).

## Reglas del proyecto que no se negocian

- Filtrar siempre por `organizationId`.
- Nunca registrar en logs el contenido de respuestas ni datos personales.
- Fotos y firmas en almacenamiento privado con URLs firmadas de corta duración.
- Secretos solo en variables de entorno; si añades una, actualiza `.env.example`.
- Las respuestas se insertan de forma idempotente por `clientId`.
- La IA nunca escribe en base de datos; su salida se valida con Zod.

## Tests

- Vitest para lógica: fichero `*.test.ts` junto al código. Casos normales, límite y de error.
- Prueba el aislamiento entre organizaciones en cada repositorio nuevo (la organización B no ve datos de la A).
- Playwright para flujos de la demo en `e2e/`, incluido el modo sin conexión (`context.setOffline(true)`).
- Cita en el test el criterio que cubre: `// Cubre: CA-SUB-02`.
- Nunca desactives ni saltes un test para conseguir verde.

## Flujo de trabajo

1. Rama `issue-<n>`.
2. Implementa en el orden del issue; ejecuta los tests a menudo.
3. Antes de terminar:
   ```bash
   npm run lint && npm run typecheck && npm test
   ```
   y `npm run test:e2e` si tocas un flujo de la demo.
4. Commits en inglés con Conventional Commits y el número del issue: `feat(submissions): dedupe by clientId (#57)`.
5. `git push -u origin issue-<n>` y comentario en el issue con el resumen y el resultado de los comandos.

## Definición de hecho

- [ ] Hace exactamente lo descrito en el issue y en `design.md`.
- [ ] Compila, linter limpio, tests en verde.
- [ ] Tests nuevos para cada criterio de aceptación de la tarea.
- [ ] Sin `any`, sin `console.log` de depuración, sin código comentado.
- [ ] `.env.example` y seed actualizados si hacía falta.
- [ ] Comentario de cierre en el issue.
