import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SubmissionListResult } from "@/server/submissions/submission.service";

function pageHref(formId: string, query: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  params.set("page", String(page));
  return `/admin/forms/${formId}/submissions?${params.toString()}`;
}

/** Tabla del listado con paginación de 20. Cubre: RF-SUB-05, CA-SUB-04 */
export function SubmissionsTable({
  formId,
  result,
  query,
}: {
  formId: string;
  result: SubmissionListResult;
  query: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  if (result.items.length === 0) {
    return <p className="text-muted-foreground">No hay respuestas para este formulario todavía.</p>;
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Enviado por</TableHead>
            <TableHead>Versión</TableHead>
            <TableHead className="text-right">Ficha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.items.map((item) => (
            <TableRow key={item.id} data-testid="submission-row">
              <TableCell>{item.capturedAt.toLocaleString("es-ES")}</TableCell>
              <TableCell>{item.submittedByName ?? "—"}</TableCell>
              <TableCell data-testid="submission-version">
                {item.formVersionNumber === null ? "—" : `v${item.formVersionNumber}`}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/admin/forms/${formId}/submissions/${item.id}`} className="underline">
                  Ver
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <nav className="flex items-center justify-between text-sm" aria-label="Paginación">
        <span data-testid="submissions-total">
          {result.total} {result.total === 1 ? "respuesta" : "respuestas"} · página {result.page} de {totalPages}
        </span>
        <span className="flex gap-3">
          {result.page > 1 ? (
            <Link href={pageHref(formId, query, result.page - 1)} className="underline">
              Anterior
            </Link>
          ) : null}
          {result.page < totalPages ? (
            <Link href={pageHref(formId, query, result.page + 1)} className="underline">
              Siguiente
            </Link>
          ) : null}
        </span>
      </nav>
    </div>
  );
}
