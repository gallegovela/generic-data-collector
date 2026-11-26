import type { Form, FormStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";
import type { DraftForm } from "@/lib/form-editor/form-editor.schema";

/**
 * Repositorio de `Form`. Todas las funciones reciben `organizationId`
 * como primer parámetro y lo usan en el `where` (RNF-EDT, aislamiento
 * multi-tenant). Las que modifican devuelven `null` si el `id` no
 * pertenece a esa organización.
 */

export type FormSummary = {
  id: string;
  name: string;
  status: FormStatus;
  publishedVersionLabel: string;
  responseCount: number;
  updatedAt: Date;
};

/** Cubre: RF-PUB-01 */
function versionLabel(status: FormStatus, publishedVersion: number | null): string {
  if (publishedVersion === null) return "Sin publicar";
  return status === "published" ? `v${publishedVersion}` : `Despublicado (última v${publishedVersion})`;
}

export async function listFormsByOrganization(organizationId: string): Promise<FormSummary[]> {
  const forms = await prisma.form.findMany({
    where: { organizationId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  return forms.map((form) => ({
    id: form.id,
    name: form.name,
    status: form.status,
    publishedVersionLabel: versionLabel(form.status, form.publishedVersion),
    // TODO(submissions-dashboard, RF-SUB-05): sustituir cuando exista Submission
    responseCount: 0,
    updatedAt: form.updatedAt,
  }));
}

export function findFormById(organizationId: string, id: string): Promise<Form | null> {
  return prisma.form.findFirst({ where: { id, organizationId } });
}

export function createForm(
  organizationId: string,
  data: { name: string; draft: DraftForm },
): Promise<Form> {
  return prisma.form.create({
    data: { organizationId, name: data.name, draftSchema: data.draft },
  });
}

async function updateOwned(
  organizationId: string,
  id: string,
  data: { name?: string; draftSchema?: DraftForm; archivedAt?: Date },
): Promise<Form | null> {
  const { count } = await prisma.form.updateMany({ where: { id, organizationId }, data });
  if (count === 0) return null;
  return findFormById(organizationId, id);
}

export function updateFormName(
  organizationId: string,
  id: string,
  name: string,
): Promise<Form | null> {
  return updateOwned(organizationId, id, { name });
}

export function updateFormDraft(
  organizationId: string,
  id: string,
  draft: DraftForm,
): Promise<Form | null> {
  return updateOwned(organizationId, id, { draftSchema: draft });
}

export function archiveForm(organizationId: string, id: string): Promise<Form | null> {
  return updateOwned(organizationId, id, { archivedAt: new Date() });
}
