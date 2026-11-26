import type { Submission } from "@prisma/client";
import type { Field } from "@/lib/form-schema";
import { NotFoundError } from "@/lib/errors";
import {
  SUBMISSIONS_PAGE_SIZE,
  type SubmissionFiltersInput,
} from "@/lib/submissions-dashboard/submission-filters.schema";
import {
  findFilterableFields,
  findSubmissionById,
  getSubmissionStats,
  listSubmissionsByForm,
  type SubmissionExportFilters,
  type SubmissionListFilters,
  type SubmissionListItem,
  type SubmissionStats,
} from "./submission.repository";

export type SubmissionListResult = {
  items: SubmissionListItem[];
  total: number;
  page: number;
  pageSize: number;
  filterableFields: Field[];
};

function startOfDay(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function endOfDay(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/**
 * Traduce el querystring parseado a filtros del repositorio. Lo usan el
 * listado y el exportador. Cubre: RF-SUB-05, RF-SUB-06, RF-SUB-07, RF-OUT-11
 */
export function toListFilters(
  input: Omit<SubmissionFiltersInput, "page">,
  filterableFields: Field[],
): SubmissionExportFilters {
  const filters: SubmissionExportFilters = {};
  if (input.dateFrom) filters.dateFrom = startOfDay(input.dateFrom);
  if (input.dateTo) filters.dateTo = endOfDay(input.dateTo);
  if (input.submittedBy) filters.submittedBy = input.submittedBy;
  if (input.q) filters.textQuery = input.q;

  if (input.fieldId && input.fieldValue !== undefined) {
    const field = filterableFields.find((f) => f.id === input.fieldId);
    // Si el campo ya no existe en el formulario, se ignora el filtro.
    if (field) {
      filters.fieldFilter = {
        fieldId: field.id,
        value: field.type === "yes_no" ? input.fieldValue === "true" : input.fieldValue,
      };
    }
  }
  return filters;
}

/** Cubre: RF-SUB-05, RF-SUB-06, RF-SUB-07 */
export async function listSubmissions(
  organizationId: string,
  formId: string,
  input: SubmissionFiltersInput,
): Promise<SubmissionListResult> {
  const filterableFields = await findFilterableFields(organizationId, formId);
  const filters: SubmissionListFilters = { ...toListFilters(input, filterableFields), page: input.page };

  const { items, total } = await listSubmissionsByForm(organizationId, formId, filters);
  return { items, total, page: input.page, pageSize: SUBMISSIONS_PAGE_SIZE, filterableFields };
}

export async function getSubmissionDetail(organizationId: string, id: string): Promise<Submission> {
  const submission = await findSubmissionById(organizationId, id);
  if (!submission) throw new NotFoundError("No se ha encontrado la respuesta.");
  return submission;
}

/** Cubre: RF-SUB-10 */
export function getHomeStats(organizationId: string): Promise<SubmissionStats> {
  return getSubmissionStats(organizationId);
}
