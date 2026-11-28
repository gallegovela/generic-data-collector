import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listPublishedForms } from "@/server/form-publishing/form-publishing.repository";

export const dynamic = "force-dynamic";

/**
 * Listado de formularios publicados de la organización para rellenar.
 *
 * Cubre: RF-COL-01
 */
export default async function CollectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const forms = await listPublishedForms(user.organizationId);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Formularios</h1>
      <p className="text-muted-foreground">Hola, {user.name}. Elige el formulario que quieres rellenar.</p>
      {forms.length === 0 ? (
        <p data-testid="collect-empty" className="text-muted-foreground">
          Todavía no hay formularios publicados.
        </p>
      ) : (
        <ul data-testid="collect-list" className="flex flex-col gap-2">
          {forms.map((form) => (
            <li key={form.id}>
              <Link
                href={`/f/${form.slug}`}
                className="flex min-h-12 items-center rounded-lg border px-4 py-3 text-base font-medium hover:bg-muted"
              >
                {form.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
