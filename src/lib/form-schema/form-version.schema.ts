import { z } from "zod";
import { FieldSchema } from "./field.schema";
import { ThemeSnapshotSchema } from "./theme.schema";

export const CURRENT_SCHEMA_VERSION = 1;

export const FormVersionSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    theme: ThemeSnapshotSchema.optional(),
    fields: z.array(FieldSchema).min(1),
  })
  .superRefine((form, ctx) => {
    const firstIndex = new Map<string, number>();
    form.fields.forEach((field, index) => {
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

    form.fields.forEach((field, index) => {
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
  });
export type FormVersion = z.infer<typeof FormVersionSchema>;
