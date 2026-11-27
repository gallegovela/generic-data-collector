import Link from "next/link";
import type { PublishedFormRow } from "@/server/form-publishing/form-publishing.repository";

type Props = {
  forms: PublishedFormRow[];
  userName: string;
  isAdmin: boolean;
};

/**
 * Listado presentacional de formularios publicados con acción «Rellenar».
 *
 * Cubre: RF-AUT-09, CA-AUT-11
 */
export function PublishedFormsList({ forms, userName, isAdmin }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Formularios</h1>
        <p className="text-muted-foreground">Hola, {userName}.</p>
        {isAdmin ? (
          <Link href="/admin" className="inline-block text-sm font-medium underline underline-offset-4">
            Ir al panel
          </Link>
        ) : null}
      </header>

      {forms.length === 0 ? (
        <p data-testid="forms-empty" className="text-muted-foreground">
          Todavía no hay formularios publicados.
        </p>
      ) : (
        <ul data-testid="published-forms" className="flex flex-col gap-3">
          {forms.map((form) => (
            <li
              key={form.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm"
            >
              <span className="min-w-0 break-words font-medium">{form.name}</span>
              <Link
                href={`/f/${form.slug}`}
                data-testid="fill-link"
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Rellenar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
