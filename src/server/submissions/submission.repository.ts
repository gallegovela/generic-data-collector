import { Prisma, type Submission } from "@prisma/client";
import { FormVersionSchema, type Field, type FormVersion } from "@/lib/form-schema";
import { SUBMISSIONS_PAGE_SIZE } from "@/lib/submissions-dashboard/submission-filters.schema";
import { prisma } from "@/server/db/client";

// Todas las consultas llevan organizationId (RNF-SUB-03). Nada de contenido
// de respuestas en logs.

export type SubmissionListFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  submittedBy?: string;
  fieldFilter?: { fieldId: string; value: string | boolean };
  textQuery?: string;
  page: number;
};

export type SubmissionListItem = {
  id: string;
  capturedAt: Date;
  syncedAt: Date;
  submittedByName: string | null;
};

export type SubmissionStats = {
  today: number;
  thisWeek: number;
  byForm: Array<{ formId: string; formTitle: string; count: number }>;
};

/** Búsqueda de texto libre (RF-SUB-07): `answers::text ILIKE`, parametrizada. */
export async function findSubmissionIdsByText(
  organizationId: string,
  formId: string,
  query: string,
): Promise<string[]> {
  const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "submissions"
      WHERE "organizationId" = ${organizationId} AND "formId" = ${formId}
        AND "answers"::text ILIKE ${pattern}`,
  );
  return rows.map((r) => r.id);
}

export type SubmissionExportFilters = Omit<SubmissionListFilters, "page">;

/** Devuelve null si textQuery no encuentra ningún id (resultado vacío seguro). */
async function buildSubmissionWhere(
  organizationId: string,
  formId: string,
  filters: SubmissionExportFilters,
): Promise<Prisma.SubmissionWhereInput | null> {
  const where: Prisma.SubmissionWhereInput = { organizationId, formId };

  if (filters.textQuery) {
    const ids = await findSubmissionIdsByText(organizationId, formId, filters.textQuery);
    if (ids.length === 0) return null;
    where.id = { in: ids };
  }
  if (filters.dateFrom || filters.dateTo) {
    where.capturedAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }
  if (filters.submittedBy) {
    where.submittedByName = { contains: filters.submittedBy, mode: "insensitive" };
  }
  if (filters.fieldFilter) {
    where.answers = { path: [filters.fieldFilter.fieldId], equals: filters.fieldFilter.value };
  }
  return where;
}

/** Nº de respuestas del formulario en la organización, sin filtros. Cubre: RF-OUT-11 */
export function countSubmissionsOfForm(organizationId: string, formId: string): Promise<number> {
  return prisma.submission.count({ where: { organizationId, formId } });
}

/** Mismas filas que el listado sin paginar. Cubre: RF-OUT-05, RF-OUT-11 */
export async function listSubmissionsForExport(
  organizationId: string,
  formId: string,
  filters: SubmissionExportFilters,
  limit: number,
): Promise<
  Array<
    Pick<
      Submission,
      | "formTitle"
      | "capturedAt"
      | "syncedAt"
      | "submittedByName"
      | "formVersionNumber"
      | "formVersionSnapshot"
      | "answers"
    >
  >
> {
  const where = await buildSubmissionWhere(organizationId, formId, filters);
  if (!where) return [];
  return prisma.submission.findMany({
    where,
    orderBy: [{ capturedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      formTitle: true,
      capturedAt: true,
      syncedAt: true,
      submittedByName: true,
      formVersionNumber: true,
      formVersionSnapshot: true,
      answers: true,
    },
  });
}

export async function listSubmissionsByForm(
  organizationId: string,
  formId: string,
  filters: SubmissionListFilters,
): Promise<{ items: SubmissionListItem[]; total: number }> {
  const where = await buildSubmissionWhere(organizationId, formId, filters);
  if (!where) return { items: [], total: 0 };

  const [items, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      orderBy: { capturedAt: "desc" },
      skip: (Math.max(filters.page, 1) - 1) * SUBMISSIONS_PAGE_SIZE,
      take: SUBMISSIONS_PAGE_SIZE,
      select: { id: true, capturedAt: true, syncedAt: true, submittedByName: true },
    }),
    prisma.submission.count({ where }),
  ]);
  return { items, total };
}

export function findSubmissionById(organizationId: string, id: string): Promise<Submission | null> {
  return prisma.submission.findFirst({ where: { id, organizationId } });
}

/** Campos single_choice/yes_no de la respuesta más reciente (RF-SUB-06). */
export async function findFilterableFields(organizationId: string, formId: string): Promise<Field[]> {
  const latest = await prisma.submission.findFirst({
    where: { organizationId, formId },
    orderBy: { capturedAt: "desc" },
    select: { formVersionSnapshot: true },
  });
  if (!latest) return [];
  const parsed = FormVersionSchema.safeParse(latest.formVersionSnapshot);
  if (!parsed.success) return [];
  return parsed.data.fields.filter((f) => f.type === "single_choice" || f.type === "yes_no");
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfWeek(now: Date): Date {
  const day = startOfToday(now);
  const offset = (day.getDay() + 6) % 7; // lunes = 0
  day.setDate(day.getDate() - offset);
  return day;
}

export async function getSubmissionStats(organizationId: string): Promise<SubmissionStats> {
  const now = new Date();
  const [today, thisWeek, groups] = await Promise.all([
    prisma.submission.count({ where: { organizationId, capturedAt: { gte: startOfToday(now) } } }),
    prisma.submission.count({ where: { organizationId, capturedAt: { gte: startOfWeek(now) } } }),
    prisma.submission.groupBy({
      by: ["formId", "formTitle"],
      where: { organizationId },
      _count: { _all: true },
      orderBy: { _count: { formId: "desc" } },
    }),
  ]);
  return {
    today,
    thisWeek,
    byForm: groups.map((g) => ({ formId: g.formId, formTitle: g.formTitle, count: g._count._all })),
  };
}

/** Solo para tests y datos de ejemplo; no valida `answers` (RF-SUB-03 es de la recepción real). */
export function createSubmissionFixture(
  organizationId: string,
  data: {
    formId: string;
    formTitle: string;
    clientId: string;
    formVersionSnapshot: FormVersion;
    answers: Record<string, unknown>;
    submittedByName?: string;
    formVersionNumber?: number;
    capturedAt: Date;
  },
): Promise<Submission> {
  return prisma.submission.create({
    data: {
      organizationId,
      formId: data.formId,
      formTitle: data.formTitle,
      clientId: data.clientId,
      formVersionSnapshot: data.formVersionSnapshot as Prisma.InputJsonValue,
      answers: data.answers as Prisma.InputJsonValue,
      submittedByName: data.submittedByName ?? null,
      formVersionNumber: data.formVersionNumber ?? null,
      capturedAt: data.capturedAt,
    },
  });
}
