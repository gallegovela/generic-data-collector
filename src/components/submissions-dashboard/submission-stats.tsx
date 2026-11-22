import Link from "next/link";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import type { SubmissionStats } from "@/server/submissions/submission.repository";

/** Tarjetas del panel de inicio. Cubre: RF-SUB-10, CA-SUB-06 */
export function SubmissionStats({ stats }: { stats: SubmissionStats }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Respuestas de hoy</CardTitle>
          <CardContent className="text-3xl font-semibold" data-testid="stat-today">
            {stats.today}
          </CardContent>
        </Card>
        <Card>
          <CardTitle>Respuestas de esta semana</CardTitle>
          <CardContent className="text-3xl font-semibold" data-testid="stat-week">
            {stats.thisWeek}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardTitle>Por formulario</CardTitle>
        <CardContent>
          {stats.byForm.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay respuestas.</p>
          ) : (
            <ul className="divide-y">
              {stats.byForm.map((f) => (
                <li key={f.formId} data-testid="stat-form" className="flex items-center justify-between py-2">
                  <Link href={`/admin/forms/${f.formId}/submissions`} className="underline">
                    {f.formTitle}
                  </Link>
                  <span className="font-medium">{f.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
