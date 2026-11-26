import type { FormVersion } from "@/lib/form-schema";
import { findUserByEmail } from "@/server/auth/user.repository";
import { prisma } from "@/server/db/client";
import { createSubmissionFixture } from "@/server/submissions/submission.repository";
import { buildDailyReportFormVersion, DAILY_REPORT_FORM_TITLE } from "../../prisma/fixtures/submissions-dashboard.fixtures";
import { ADMIN_EMAIL } from "./form-editor";

export async function demoOrganizationId(): Promise<string> {
  const admin = await findUserByEmail(ADMIN_EMAIL);
  if (!admin) throw new Error("Falta el usuario demo: ejecuta `npm run db:seed`.");
  return admin.organizationId;
}

export function uniqueFormId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export async function addSubmission(
  organizationId: string,
  formId: string,
  n: number,
  opts: {
    answers?: Record<string, unknown>;
    capturedAt?: Date;
    by?: string;
    title?: string;
    formVersion?: FormVersion;
    formVersionNumber?: number;
  } = {},
) {
  return createSubmissionFixture(organizationId, {
    formId,
    formTitle: opts.title ?? DAILY_REPORT_FORM_TITLE,
    clientId: `${formId}-${n}`,
    formVersionSnapshot: opts.formVersion ?? buildDailyReportFormVersion(),
    answers: opts.answers ?? { site: `Obra ${n}`, has_incidents: false },
    submittedByName: opts.by ?? "Ana Encargada",
    capturedAt: opts.capturedAt ?? new Date(Date.now() - n * 1000),
    // Igual que en producción: la versión publicada aporta siempre id y número juntos.
    ...(opts.formVersionNumber === undefined
      ? {}
      : { formVersionId: `v${opts.formVersionNumber}`, formVersionNumber: opts.formVersionNumber }),
  });
}

export async function deleteSubmissionsOfForms(formIds: string[]): Promise<void> {
  await prisma.submission.deleteMany({ where: { formId: { in: formIds } } });
}
