import { notFound } from "next/navigation";
import { FormEditor } from "@/components/form-editor/form-editor";
import { DraftFormSchema } from "@/lib/form-editor/form-editor.schema";
import { requireAdminPage } from "@/server/auth/session";
import { findFormById } from "@/server/forms/form.repository";

export const dynamic = "force-dynamic";

/** Editor visual de un formulario. Cubre: RF-EDT-03 a RF-EDT-10 */
export default async function FormEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPage();
  const { id } = await params;

  const form = await findFormById(user.organizationId, id);
  if (!form || form.archivedAt) notFound();

  // El borrador en BD puede no ser válido aún (p. ej. guardado antes de una
  // regla nueva); se muestra tal cual solo si cumple el esquema.
  const parsed = DraftFormSchema.safeParse(form.draftSchema);
  const draft = parsed.success ? parsed.data : { title: form.name, fields: [] };

  return <FormEditor formId={form.id} formName={form.name} initialDraft={draft} />;
}
