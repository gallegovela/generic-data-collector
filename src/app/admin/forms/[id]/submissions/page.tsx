import { SubmissionFiltersBar } from "@/components/submissions-dashboard/submission-filters-bar";
import { SubmissionsTable } from "@/components/submissions-dashboard/submissions-table";
import { submissionFiltersSchema } from "@/lib/submissions-dashboard/submission-filters.schema";
import { requireAdminPage } from "@/server/auth/session";
import { listSubmissions } from "@/server/submissions/submission.service";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "" ? undefined : v;
}

/** Listado de respuestas de un formulario. Cubre: RF-SUB-05, RF-SUB-06, RF-SUB-07 */
export default async function SubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireAdminPage();
  const { id } = await params;
  const raw = await searchParams;

  const keys = ["dateFrom", "dateTo", "submittedBy", "fieldId", "fieldValue", "q", "page"] as const;
  const query = Object.fromEntries(keys.map((k) => [k, first(raw[k])]));
  // Filtros inválidos en la URL: se descartan y se muestra el listado sin filtrar.
  const parsed = submissionFiltersSchema.safeParse(query);
  const filters = parsed.success ? parsed.data : submissionFiltersSchema.parse({});

  const result = await listSubmissions(user.organizationId, id, filters);
  const { page: _page, ...queryWithoutPage } = query;
  void _page;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Respuestas</h1>
      <SubmissionFiltersBar formId={id} values={filters} filterableFields={result.filterableFields} />
      <SubmissionsTable formId={id} result={result} query={queryWithoutPage} />
    </div>
  );
}
