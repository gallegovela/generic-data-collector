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
  formVersionNumber?: number;
  page: number;
};

export type SubmissionListItem = {
  id: string;
  capturedAt: Date;
  syncedAt: Date;
  submittedByName: string | null;
  formVersionNumber: number | null;
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

export async function listSubmissionsByForm(
  organizationId: string,
  formId: string,
  filters: SubmissionListFilters,
): Promise<{ items: SubmissionListItem[]; total: number }> {
  const where: Prisma.SubmissionWhereInput = { organizationId, formId };

  if (filters.textQuery) {
    const ids = await findSubmissionIdsByText(organizationId, formId, filters.textQuery);
    if (ids.length === 0) return { items: [], total: 0 };
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
  if (filters.formVersionNumber !== undefined) {
    where.formVersionNumber = filters.formVersionNumber;
  }
  if (filters.fieldFilter) {
    where.answers = { path: [filters.fieldFilter.fieldId], equals: filters.fieldFilter.value };
  }

  const [items, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      orderBy: { capturedAt: "desc" },
      skip: (Math.max(filters.page, 1) - 1) * SUBMISSIONS_PAGE_SIZE,
      take: SUBMISSIONS_PAGE_SIZE,
      select: {
        id: true,
        capturedAt: true,
        syncedAt: true,
        submittedByName: true,
        formVersionNumber: true,
      },
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

/** Cubre: RF-SUB-02 (idempotencia por organizationId + clientId). */
export function findSubmissionByClientId(
  organizationId: string,
  clientId: string,
): Promise<Submission | null> {
  return prisma.submission.findFirst({ where: { organizationId, clientId } });
}

/** Lanza el error de Prisma P2002 si ya existe (organizationId, clientId). */
export function insertSubmission(
  organizationId: string,
  data: {
    formId: string;
    formTitle: string;
    clientId: string;
    formVersionId: string;
    formVersionNumber: number;
    formVersionSnapshot: FormVersion;
    answers: Record<string, unknown>;
    submittedByUserId: string | null;
    submittedByName: string | null;
    capturedAt: Date;
  },
): Promise<Submission> {
  return prisma.submission.create({
    data: {
      organizationId,
      formId: data.formId,
      formTitle: data.formTitle,
      clientId: data.clientId,
      formVersionId: data.formVersionId,
      formVersionNumber: data.formVersionNumber,
      formVersionSnapshot: data.formVersionSnapshot as Prisma.InputJsonValue,
      answers: data.answers as Prisma.InputJsonValue,
      submittedByUserId: data.submittedByUserId,
      submittedByName: data.submittedByName,
      capturedAt: data.capturedAt,
    },
  });
}

/** Números de versión distintos con respuestas de ese formId, ascendente; ignora los NULL. */
export async function listFormVersionNumbers(organizationId: string, formId: string): Promise<number[]> {
  const rows = await prisma.submission.findMany({
    where: { organizationId, formId, formVersionNumber: { not: null } },
    distinct: ["formVersionNumber"],
    orderBy: { formVersionNumber: "asc" },
    select: { formVersionNumber: true },
  });
  return rows.flatMap((r) => (r.formVersionNumber === null ? [] : [r.formVersionNumber]));
}

/** Solo para tests y datos de ejemplo; no valida `answers` (la validación real es de createSubmission). */
export function createSubmissionFixture(
  organizationId: string,
  data: {
    formId: string;
    formTitle: string;
    clientId: string;
    formVersionSnapshot: FormVersion;
    answers: Record<string, unknown>;
    submittedByName?: string;
    formVersionId?: string;
    formVersionNumber?: number;
    submittedByUserId?: string;
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
      formVersionId: data.formVersionId ?? null,
      formVersionNumber: data.formVersionNumber ?? null,
      submittedByUserId: data.submittedByUserId ?? null,
      capturedAt: data.capturedAt,
    },
  });
}
