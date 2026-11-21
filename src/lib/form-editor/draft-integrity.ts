import type { RefinementCtx } from "zod";
import type { Field } from "@/lib/form-schema";

/**
 * Mismo criterio que la comprobación interna de `form-version.schema.ts`
 * (form-schema), pero sin exigir al menos 1 campo: un borrador puede
 * estar vacío.
 *
 * Cubre: RF-EDT-07, RF-EDT-10
 */
export function checkDraftIntegrity(draft: { fields: Field[] }, ctx: RefinementCtx): void {
  const firstIndex = new Map<string, number>();
  draft.fields.forEach((field, index) => {
    if (firstIndex.has(field.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["fields", index, "id"],
        message: `Id de campo duplicado: "${field.id}".`,
      });
    } else {
      firstIndex.set(field.id, index);
    }
  });

  draft.fields.forEach((field, index) => {
    if (!field.visibleIf) return;
    const refIndex = firstIndex.get(field.visibleIf.fieldId);
    const path = ["fields", index, "visibleIf", "fieldId"];
    if (refIndex === undefined) {
      ctx.addIssue({ code: "custom", path, message: `"${field.visibleIf.fieldId}" no existe.` });
    } else if (refIndex >= index) {
      ctx.addIssue({
        code: "custom",
        path,
        message: `"${field.visibleIf.fieldId}" es posterior o es el propio campo (referencia circular no permitida).`,
      });
    }
  });
}
