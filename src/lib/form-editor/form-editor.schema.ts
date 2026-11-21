import { z } from "zod";
import { FieldSchema, type Field } from "@/lib/form-schema";
import { checkDraftIntegrity } from "./draft-integrity";

export const createFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
});
export type CreateFormInput = z.infer<typeof createFormSchema>;

export const renameFormSchema = createFormSchema;
export type RenameFormInput = z.infer<typeof renameFormSchema>;

export const duplicateFormSchema = z.object({
  sourceFormId: z.string().min(1),
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
});
export type DuplicateFormInput = z.infer<typeof duplicateFormSchema>;

export const DraftFormSchema = z
  .object({
    title: z.string().trim().min(1, "El título es obligatorio.").max(200),
    description: z.string().max(2000).optional(),
    fields: z.array(FieldSchema), // sin .min(1): un borrador puede no tener campos
  })
  .superRefine(checkDraftIntegrity);
export type DraftForm = z.infer<typeof DraftFormSchema>;

export const saveDraftSchema = z.object({ draft: DraftFormSchema });
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export type DraftFieldIssue = { fieldId: string; message: string };

/**
 * Convierte el `error` de un `DraftFormSchema.safeParse` fallido en una
 * lista `{ fieldId, message }` usando el índice del `path`
 * (["fields", index, ...]) para resolver el id del campo. Los problemas
 * que no son de un campo (p. ej. el título) se omiten.
 *
 * Cubre: RF-EDT-10, CA-EDT-07
 */
export function mapDraftIssuesToFields(
  draft: { fields: Field[] },
  error: z.ZodError,
): DraftFieldIssue[] {
  const result: DraftFieldIssue[] = [];
  for (const issue of error.issues) {
    const [root, index] = issue.path;
    if (root !== "fields" || typeof index !== "number") continue;
    const field = draft.fields[index];
    if (!field) continue;
    result.push({ fieldId: field.id, message: issue.message });
  }
  return result;
}
