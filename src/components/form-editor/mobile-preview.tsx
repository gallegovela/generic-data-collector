import { Badge } from "@/components/ui/badge";
import { DEFAULT_THEME } from "@/lib/form-editor/default-theme";
import type { Field } from "@/lib/form-schema";

function describeCondition(field: Field, fields: Field[]): string | null {
  const c = field.visibleIf;
  if (!c) return null;
  const source = fields.find((f) => f.id === c.fieldId)?.label ?? c.fieldId;
  if (c.operator === "isAnswered") return `Visible si «${source}» está respondido`;
  const value = typeof c.value === "boolean" ? (c.value ? "Sí" : "No") : String(c.value ?? "");
  const op = c.operator === "equals" ? "=" : c.operator === "notEquals" ? "≠" : "incluye";
  return `Visible si «${source}» ${op} ${value}`;
}

/**
 * Vista previa simplificada y no interactiva, con `DEFAULT_THEME`. Lista
 * todos los campos sin evaluar `visibleIf`: marca los condicionales con
 * una insignia.
 */
export function MobilePreview({ title, fields }: { title: string; fields: Field[] }) {
  return (
    <div
      aria-label="Vista previa móvil"
      className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[2rem] border-4 border-foreground/80 bg-background"
      style={{ fontFamily: DEFAULT_THEME.fontFamily }}
    >
      <div
        className="px-4 py-3 text-sm font-semibold text-white"
        style={{ backgroundColor: DEFAULT_THEME.primaryColor }}
      >
        {title || "Sin título"}
      </div>
      <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto p-4">
        {fields.map((field) => {
          const condition = describeCondition(field, fields);
          return (
            <div key={field.id} className="flex flex-col gap-1">
              {field.type === "section" ? (
                <p className="border-b pb-1 text-sm font-semibold">{field.label}</p>
              ) : (
                <>
                  <p className="text-xs font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </p>
                  <div className="h-7 rounded-md border border-input bg-muted/40" />
                </>
              )}
              {condition && (
                <Badge variant="outline" className="w-fit text-[10px]" title={condition}>
                  {condition}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
