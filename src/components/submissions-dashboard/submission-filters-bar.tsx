import Link from "next/link";
import type { Field } from "@/lib/form-schema";
import type { SubmissionFiltersInput } from "@/lib/submissions-dashboard/submission-filters.schema";

const inputClass = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm";

/** Filtros del listado por querystring, sin JavaScript de cliente. Cubre: RF-SUB-06, RF-SUB-07 */
export function SubmissionFiltersBar({
  formId,
  values,
  filterableFields,
}: {
  formId: string;
  values: Partial<SubmissionFiltersInput>;
  filterableFields: Field[];
}) {
  const selected = filterableFields.find((f) => f.id === values.fieldId);
  return (
    <form method="get" className="flex flex-wrap items-end gap-3" data-testid="filters-form">
      <label className="flex flex-col gap-1 text-sm">
        Desde
        <input type="date" name="dateFrom" defaultValue={values.dateFrom} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Hasta
        <input type="date" name="dateTo" defaultValue={values.dateTo} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Enviado por
        <input type="text" name="submittedBy" defaultValue={values.submittedBy} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Buscar texto
        <input type="search" name="q" defaultValue={values.q} className={inputClass} />
      </label>
      {filterableFields.length > 0 ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Campo
            <select name="fieldId" defaultValue={values.fieldId ?? ""} className={inputClass}>
              <option value="">(sin filtro)</option>
              {filterableFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Valor
            <select name="fieldValue" defaultValue={values.fieldValue ?? ""} className={inputClass}>
              <option value="">(cualquiera)</option>
              {(selected && (selected.type === "single_choice")
                ? selected.config.options.map((o) => ({ value: o.id, label: o.label }))
                : [
                    { value: "true", label: "Sí" },
                    { value: "false", label: "No" },
                  ]
              ).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
      <button type="submit" className="h-8 rounded-lg bg-primary px-3 text-sm text-primary-foreground">
        Filtrar
      </button>
      <Link href={`/admin/forms/${formId}/submissions`} className="text-sm underline">
        Limpiar
      </Link>
    </form>
  );
}
