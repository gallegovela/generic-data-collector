import { redirect } from "next/navigation";
import { PublishedFormsList } from "@/components/forms/published-forms-list";
import { getCurrentUser } from "@/server/auth/session";
import { listPublishedFormsForOrg } from "@/server/form-publishing/form-publishing.service";

export const dynamic = "force-dynamic";

/**
 * Destino del collector: formularios publicados de su organización.
 *
 * Cubre: RF-AUT-09, CA-AUT-14
 */
export default async function FormsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const forms = await listPublishedFormsForOrg(user.organizationId);
  return <PublishedFormsList forms={forms} userName={user.name} isAdmin={user.role === "admin"} />;
}
