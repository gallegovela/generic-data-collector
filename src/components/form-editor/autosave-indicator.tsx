import type { AutosaveStatus } from "@/hooks/use-autosave-draft";
import type { Field } from "@/lib/form-schema";

/**
 * "Guardando…" / "Guardado" / error con el campo señalado.
 *
 * Cubre: RF-EDT-08, RF-EDT-10, CA-EDT-03, CA-EDT-07
 */
export function AutosaveIndicator({ status, fields }: { status: AutosaveStatus; fields: Field[] }) {
  let text = "";
  let tone = "text-muted-foreground";

  if (status.phase === "saving") text = "Guardando…";
  else if (status.phase === "saved") text = "Guardado";
  else if (status.phase === "invalid") {
    tone = "text-destructive";
    const first = status.issues[0];
    const label = first ? fields.find((f) => f.id === first.fieldId)?.label : undefined;
    text = label
      ? `No se puede guardar: revisa «${label}».`
      : "No se puede guardar: revisa el borrador.";
  }

  return (
    <span role="status" data-testid="autosave-indicator" className={`text-sm ${tone}`}>
      {text}
    </span>
  );
}
