import { FormsTable } from "@/components/form-editor/forms-table";
import { listForms } from "@/server/forms/form.service";
import { requireAdminPage } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** Listado de formularios de la organización. Cubre: RF-EDT-01 */
export default async function FormsPage() {
  const user = await requireAdminPage();
  const forms = await listForms(user.organizationId);

  return (
    <FormsTable forms={forms.map((form) => ({ ...form, updatedAt: form.updatedAt.toISOString() }))} />
  );
}
