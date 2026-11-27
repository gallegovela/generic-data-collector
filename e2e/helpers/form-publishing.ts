import { TEST_CONSENT_INPUT } from "@/lib/form-publishing/consent.fixtures";
import { findUserByEmail } from "@/server/auth/user.repository";
import { publishForm } from "@/server/form-publishing/form-publishing.service";
import { ADMIN_EMAIL } from "./form-editor";

export { login, seedForm, textField, uniqueName, waitSaved } from "./form-editor";

/** Publica un formulario de la organización demo con el admin del seed. */
export async function publishViaService(
  formId: string,
  accessMode: "registered" | "public",
): Promise<{ version: number; slug: string; link: string }> {
  const admin = await findUserByEmail(ADMIN_EMAIL);
  if (!admin) throw new Error("Falta el usuario demo: ejecuta `npm run db:seed`.");
  return publishForm(
    admin.organizationId,
    admin.id,
    formId,
    accessMode === "public" ? { accessMode, consent: TEST_CONSENT_INPUT } : { accessMode },
  );
}
