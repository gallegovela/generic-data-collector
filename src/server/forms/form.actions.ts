"use server";

import { revalidatePath } from "next/cache";
import {
  DraftFormSchema,
  createFormSchema,
  duplicateFormSchema,
  renameFormSchema,
  type DraftFieldIssue,
  type DraftForm,
  mapDraftIssuesToFields,
} from "@/lib/form-editor/form-editor.schema";
import { NotFoundError } from "@/lib/errors";
import { requireSession } from "@/server/auth/session";
import * as formService from "./form.service";

const NOT_FOUND = "No se ha encontrado el formulario.";

function firstMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

/** Cubre: RF-EDT-02, CA-EDT-04 */
export async function createFormAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; formId?: string }> {
  const user = await requireSession({ role: "admin" });
  const parsed = createFormSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: firstMessage(parsed.error) };

  const form = await formService.createForm(user.organizationId, parsed.data);
  revalidatePath("/admin/forms");
  return { formId: form.id };
}

/** Cubre: CA-EDT-05 */
export async function duplicateFormAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; formId?: string }> {
  const user = await requireSession({ role: "admin" });
  const parsed = duplicateFormSchema.safeParse({
    sourceFormId: formData.get("sourceFormId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { error: firstMessage(parsed.error) };

  try {
    const form = await formService.duplicateForm(user.organizationId, parsed.data);
    revalidatePath("/admin/forms");
    return { formId: form.id };
  } catch (error) {
    if (error instanceof NotFoundError) return { error: NOT_FOUND };
    throw error;
  }
}

export async function renameFormAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireSession({ role: "admin" });
  const id = formData.get("formId");
  const parsed = renameFormSchema.safeParse({ name: formData.get("name") });
  if (typeof id !== "string" || id.length === 0) return { error: NOT_FOUND };
  if (!parsed.success) return { error: firstMessage(parsed.error) };

  try {
    await formService.renameForm(user.organizationId, id, parsed.data);
    revalidatePath("/admin/forms");
    return {};
  } catch (error) {
    if (error instanceof NotFoundError) return { error: NOT_FOUND };
    throw error;
  }
}

/** Cubre: CA-EDT-06 */
export async function archiveFormAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireSession({ role: "admin" });
  const id = formData.get("formId");
  if (typeof id !== "string" || id.length === 0) return { error: NOT_FOUND };

  try {
    await formService.archiveForm(user.organizationId, id);
    revalidatePath("/admin/forms");
    return {};
  } catch (error) {
    if (error instanceof NotFoundError) return { error: NOT_FOUND };
    throw error;
  }
}

/**
 * Llamada directamente desde el cliente (autoguardado). Devuelve los
 * `DraftFieldIssue` si el borrador no es válido, sin lanzar.
 *
 * Cubre: RF-EDT-08, RF-EDT-10, CA-EDT-03, CA-EDT-07
 */
export async function saveDraftAction(
  formId: string,
  draft: DraftForm,
): Promise<{ success: true } | { success: false; errors: DraftFieldIssue[] }> {
  const user = await requireSession({ role: "admin" });

  const parsed = DraftFormSchema.safeParse(draft);
  if (!parsed.success) {
    return { success: false, errors: mapDraftIssuesToFields(draft, parsed.error) };
  }

  try {
    await formService.saveDraft(user.organizationId, formId, { draft: parsed.data });
    return { success: true };
  } catch (error) {
    if (error instanceof formService.DraftValidationError) {
      return { success: false, errors: error.issues };
    }
    throw error;
  }
}
