"use server";

import { revalidatePath } from "next/cache";
import { ConflictError, NotFoundError } from "@/lib/errors";
import {
  publishFormSchema,
  setAccessModeSchema,
  type PublishFormInput,
  type SetAccessModeInput,
} from "@/lib/form-publishing/form-publishing.schema";
import { requireSession } from "@/server/auth/session";
import * as service from "./form-publishing.service";

const NOT_FOUND = "No se ha encontrado el formulario.";
const INVALID = "Datos inválidos.";

export type PublishActionResult =
  | { ok: true; version: number; slug: string; link: string }
  | { ok: false; error: string; issues?: { path: string; message: string }[] };

function revalidate(formId: string): void {
  revalidatePath("/admin/forms");
  revalidatePath(`/admin/forms/${formId}`);
}

/** Cubre: RF-PUB-01, RF-PUB-09, RF-PUB-11, CA-PUB-01, CA-PUB-07 */
export async function publishFormAction(
  formId: string,
  input: PublishFormInput,
): Promise<PublishActionResult> {
  const user = await requireSession({ role: "admin" });
  const parsed = publishFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };

  try {
    const result = await service.publishForm(user.organizationId, user.id, formId, parsed.data);
    revalidate(formId);
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof service.PublishValidationError) {
      return { ok: false, error: error.message, issues: error.issues };
    }
    if (error instanceof NotFoundError) return { ok: false, error: NOT_FOUND };
    if (error instanceof ConflictError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Cubre: RF-PUB-06, CA-PUB-06 */
export async function unpublishFormAction(
  formId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireSession({ role: "admin" });
  try {
    await service.unpublishForm(user.organizationId, formId);
    revalidate(formId);
    return { ok: true };
  } catch (error) {
    if (error instanceof NotFoundError) return { ok: false, error: NOT_FOUND };
    throw error;
  }
}

/** Cubre: RF-PUB-09 */
export async function setAccessModeAction(
  formId: string,
  input: SetAccessModeInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireSession({ role: "admin" });
  const parsed = setAccessModeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };
  try {
    await service.setFormAccessMode(user.organizationId, formId, parsed.data);
    revalidate(formId);
    return { ok: true };
  } catch (error) {
    if (error instanceof NotFoundError) return { ok: false, error: NOT_FOUND };
    throw error;
  }
}
