import { Prisma, type Submission } from "@prisma/client";
import {
  FormVersionSchema,
  validateSubmission,
  type Field,
  type FieldValidationError,
} from "@/lib/form-schema";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  createSubmissionInputSchema,
  isOwnFileKey,
  MAX_SUBMISSION_ANSWERS_BYTES,
  type CreateSubmissionInput,
} from "@/lib/submissions-dashboard/create-submission.schema";
import { SubmissionValidationError } from "@/lib/submissions-dashboard/submission-errors";
import {
  SUBMISSIONS_PAGE_SIZE,
  type SubmissionFiltersInput,
} from "@/lib/submissions-dashboard/submission-filters.schema";
import {
  findFilterableFields,
  findSubmissionByClientId,
  findSubmissionById,
  getSubmissionStats,
  insertSubmission,
  listFormVersionNumbers,
  listSubmissionsByForm,
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
  versions: number[];
};

export type CreateSubmissionResult = { submission: Submission; created: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Claves de archivo ajenas o malformadas en photo (FileRef[]) y signature (FileRef). */
function findInvalidFileFields(
  organizationId: string,
  fields: Array<{ id: string; type: string }>,
  data: Record<string, unknown>,
): FieldValidationError[] {
  const errors: FieldValidationError[] = [];
  for (const field of fields) {
    if (field.type !== "photo" && field.type !== "signature") continue;
    const value = data[field.id];
    if (value === undefined) continue; // oculto o sin responder
    const refs = Array.isArray(value) ? value : [value];
    const ok = refs.every((r) => isRecord(r) && typeof r.key === "string" && isOwnFileKey(organizationId, r.key));
    if (!ok) errors.push({ fieldId: field.id, message: "Archivo no válido." });
  }
  return errors;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Recibe, valida y guarda una respuesta de forma idempotente.
 * Nunca registra el contenido de `answers`.
 *
 * Cubre: RF-SUB-01, RF-SUB-02, RF-SUB-03, RF-SUB-04, RF-SUB-11
 */
export async function createSubmission(input: CreateSubmissionInput): Promise<CreateSubmissionResult> {
  // 1. Forma de la entrada.
  const parsedInput = createSubmissionInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new SubmissionValidationError([{ fieldId: "_", message: "Los datos de la respuesta no son válidos." }]);
  }
  const { organizationId, actor, form, clientId, answers, capturedAt } = parsedInput.data;

  // 2. Un usuario solo guarda en su propia organización.
  if (actor.kind === "user" && actor.userOrganizationId !== organizationId) {
    throw new ForbiddenError("No puedes guardar respuestas en otra organización.");
  }

  // 3. Tamaño máximo.
  if (Buffer.byteLength(JSON.stringify(answers), "utf8") > MAX_SUBMISSION_ANSWERS_BYTES) {
    throw new SubmissionValidationError([{ fieldId: "_", message: "La respuesta es demasiado grande." }]);
  }

  // 4. Idempotencia.
  const existing = await findSubmissionByClientId(organizationId, clientId);
  if (existing) {
    if (existing.formId !== form.id) {
      throw new ConflictError("El identificador de respuesta ya se usó en otro formulario.");
    }
    return { submission: existing, created: false };
  }

  // 5. Esquema de la versión indicada.
  const schema = FormVersionSchema.safeParse(form.schema);
  if (!schema.success) {
    throw new SubmissionValidationError([{ fieldId: "_", message: "El esquema del formulario no es válido." }]);
  }

  // 6. Validación contra ESTA versión, no la última.
  const validation = validateSubmission(schema.data, answers);
  if (!validation.success) throw new SubmissionValidationError(validation.errors);

  // 7. Claves de archivo de la propia organización (solo campos visibles: están en `data`).
  const fileErrors = findInvalidFileFields(organizationId, schema.data.fields, validation.data);
  if (fileErrors.length > 0) throw new SubmissionValidationError(fileErrors);

  // 8. Guardado.
  try {
    const submission = await insertSubmission(organizationId, {
      formId: form.id,
      formTitle: form.title,
      clientId,
      formVersionId: form.versionId,
      formVersionNumber: form.versionNumber,
      formVersionSnapshot: schema.data,
      answers: validation.data,
      submittedByUserId: actor.kind === "user" ? actor.userId : null,
      submittedByName: actor.kind === "user" ? actor.userName : null,
      capturedAt,
    });
    return { submission, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await findSubmissionByClientId(organizationId, clientId);
    if (!raced) throw error;
    if (raced.formId !== form.id) {
      throw new ConflictError("El identificador de respuesta ya se usó en otro formulario.");
    }
    return { submission: raced, created: false };
  }
}

function startOfDay(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function endOfDay(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/** Cubre: RF-SUB-05, RF-SUB-06, RF-SUB-07 */
export async function listSubmissions(
  organizationId: string,
  formId: string,
  input: SubmissionFiltersInput,
): Promise<SubmissionListResult> {
  const filterableFields = await findFilterableFields(organizationId, formId);

  const filters: SubmissionListFilters = { page: input.page };
  if (input.dateFrom) filters.dateFrom = startOfDay(input.dateFrom);
  if (input.dateTo) filters.dateTo = endOfDay(input.dateTo);
  if (input.submittedBy) filters.submittedBy = input.submittedBy;
  if (input.q) filters.textQuery = input.q;
  if (input.version !== undefined) filters.formVersionNumber = input.version;

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

  const [{ items, total }, versions] = await Promise.all([
    listSubmissionsByForm(organizationId, formId, filters),
    listFormVersionNumbers(organizationId, formId),
  ]);
  return { items, total, page: input.page, pageSize: SUBMISSIONS_PAGE_SIZE, filterableFields, versions };
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
