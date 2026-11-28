"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { formatMb } from "@/lib/admin-settings/plan.schema";
import {
  assignPlanAction,
  createPlanAction,
  deletePlanAction,
  updatePlanAction,
  type PlanActionState,
} from "@/server/admin-settings/plan.actions";

const TEXTS = {
  note: "Los planes son comunes a todas las organizaciones.",
  noLimit: "Sin límite",
  colName: "Nombre",
  colImpressions: "Impresiones/hora",
  colSubmissions: "Respuestas/hora",
  colFile: "Tamaño máx. de archivo",
  colOrganizations: "Organizaciones",
  current: "Plan actual",
  use: "Usar este plan",
  edit: "Editar",
  remove: "Borrar",
  removeBlocked: "No se puede borrar un plan asignado a organizaciones.",
  confirmRemove: "¿Borrar este plan?",
  createTitle: "Nuevo plan",
  editTitle: "Editar plan",
  fieldName: "Nombre",
  fieldImpressions: "Impresiones por hora",
  fieldSubmissions: "Respuestas por hora",
  fieldFile: "Tamaño máximo de archivo (MB)",
  hint: "Vacío = sin límite",
  create: "Crear plan",
  save: "Guardar cambios",
  cancel: "Cancelar",
} as const;

export type PlanRow = {
  id: string;
  name: string;
  maxImpressionsPerHour: number | null;
  maxSubmissionsPerHour: number | null;
  maxFileBytes: number | null;
  organizationCount: number;
};

const inputClassName =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function limitText(value: number | null): string {
  return value === null ? TEXTS.noLimit : value.toLocaleString("es-ES");
}

function mbValue(bytes: number | null): string {
  return bytes === null ? "" : String(Math.round((bytes / 1048576) * 100) / 100);
}

export function PlansManager({ plans, currentPlanId }: { plans: PlanRow[]; currentPlanId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: (prev: PlanActionState | undefined, data: FormData) => Promise<PlanActionState>, data: FormData) {
    setError(null);
    setPending(true);
    const result = await action(undefined, data);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (editing) data.set("planId", editing.id);
    const ok = await run(editing ? updatePlanAction : createPlanAction, data);
    if (ok) {
      form.reset();
      setEditing(null);
    }
  }

  function rowAction(action: typeof assignPlanAction, planId: string) {
    const data = new FormData();
    data.set("planId", planId);
    return run(action, data);
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted-foreground">{TEXTS.note}</p>

      {error ? (
        <p role="alert" className="text-sm text-destructive" data-testid="plans-error">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm" data-testid="plans-table">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">{TEXTS.colName}</th>
              <th className="px-3 py-2">{TEXTS.colImpressions}</th>
              <th className="px-3 py-2">{TEXTS.colSubmissions}</th>
              <th className="px-3 py-2">{TEXTS.colFile}</th>
              <th className="px-3 py-2">{TEXTS.colOrganizations}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              return (
                <tr key={plan.id} data-testid={`plan-row-${plan.name}`} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    {plan.name}
                    {isCurrent ? (
                      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs">{TEXTS.current}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{limitText(plan.maxImpressionsPerHour)}</td>
                  <td className="px-3 py-2">{limitText(plan.maxSubmissionsPerHour)}</td>
                  <td className="px-3 py-2">
                    {plan.maxFileBytes === null ? TEXTS.noLimit : formatMb(plan.maxFileBytes)}
                  </td>
                  <td className="px-3 py-2">{plan.organizationCount}</td>
                  <td className="flex justify-end gap-2 px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isCurrent || pending}
                      onClick={() => rowAction(assignPlanAction, plan.id)}
                    >
                      {TEXTS.use}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditing(plan)}>
                      {TEXTS.edit}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={plan.organizationCount > 0 || pending}
                      title={plan.organizationCount > 0 ? TEXTS.removeBlocked : undefined}
                      onClick={() => {
                        if (window.confirm(TEXTS.confirmRemove)) void rowAction(deletePlanAction, plan.id);
                      }}
                    >
                      {TEXTS.remove}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form key={editing?.id ?? "new"} className="flex max-w-xl flex-col gap-4" onSubmit={handleSubmit}>
        <h2 className="text-lg font-semibold">{editing ? TEXTS.editTitle : TEXTS.createTitle}</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="plan-name" className="text-sm font-medium">
            {TEXTS.fieldName}
          </label>
          <input id="plan-name" name="name" required maxLength={80} defaultValue={editing?.name ?? ""} className={inputClassName} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="plan-impressions" className="text-sm font-medium">
            {TEXTS.fieldImpressions}
          </label>
          <input
            id="plan-impressions"
            name="maxImpressionsPerHour"
            inputMode="numeric"
            placeholder={TEXTS.hint}
            defaultValue={editing?.maxImpressionsPerHour ?? ""}
            className={inputClassName}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="plan-submissions" className="text-sm font-medium">
            {TEXTS.fieldSubmissions}
          </label>
          <input
            id="plan-submissions"
            name="maxSubmissionsPerHour"
            inputMode="numeric"
            placeholder={TEXTS.hint}
            defaultValue={editing?.maxSubmissionsPerHour ?? ""}
            className={inputClassName}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="plan-file" className="text-sm font-medium">
            {TEXTS.fieldFile}
          </label>
          <input
            id="plan-file"
            name="maxFileMb"
            inputMode="decimal"
            placeholder={TEXTS.hint}
            defaultValue={mbValue(editing?.maxFileBytes ?? null)}
            className={inputClassName}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {editing ? TEXTS.save : TEXTS.create}
          </Button>
          {editing ? (
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              {TEXTS.cancel}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
