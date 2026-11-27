import type { Submission } from "@prisma/client";
import { FormVersionSchema, getVisibleFields } from "@/lib/form-schema";
import { buildFieldDisplayValue } from "@/lib/submissions-dashboard/field-display";
import { parseSubmissionConsent } from "@/lib/submissions-dashboard/create-submission.schema";
import { SubmissionConsentBlock } from "./submission-consent";
import { SubmissionFieldValue } from "./submission-field-value";

/** Ficha de una respuesta, solo lectura, con las etiquetas de su copia del esquema. Cubre: RF-SUB-08, CA-SUB-07 */
export function SubmissionDetail({ submission }: { submission: Submission }) {
  const parsed = FormVersionSchema.safeParse(submission.formVersionSnapshot);
  const answers = (submission.answers ?? {}) as Record<string, unknown>;

  if (!parsed.success) {
    return <p className="text-muted-foreground">No se puede mostrar esta respuesta: su esquema no es válido.</p>;
  }

  const fields = getVisibleFields(parsed.data, answers);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{submission.formTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {submission.submittedByName ?? "Sin nombre"} · {submission.capturedAt.toLocaleString("es-ES")}
        </p>
      </div>
      <SubmissionConsentBlock consent={parseSubmissionConsent(submission.consent)} />
      <dl className="space-y-4">
        {fields.map((field) => {
          const value = buildFieldDisplayValue(field, answers);
          if (value.kind === "section") {
            return (
              <div key={field.id} className="border-b pt-2 pb-1">
                <h2 className="text-lg font-medium">{value.title}</h2>
                {value.description ? <p className="text-sm text-muted-foreground">{value.description}</p> : null}
              </div>
            );
          }
          return (
            <div key={field.id} data-testid="detail-field">
              <dt className="text-sm font-medium text-muted-foreground">{field.label}</dt>
              <dd className="mt-1">
                <SubmissionFieldValue value={value} />
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
