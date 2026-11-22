import type { Form } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  DraftFormSchema,
  mapDraftIssuesToFields,
  type CreateFormInput,
  type DraftFieldIssue,
  type DraftForm,
  type DuplicateFormInput,
  type RenameFormInput,
  type SaveDraftInput,
} from "@/lib/form-editor/form-editor.schema";
import * as repository from "./form.repository";
import type { FormSummary } from "./form.repository";

const FORM_NOT_FOUND = "No se ha encontrado el formulario.";

/** Error de validación del borrador con los campos señalados (RF-EDT-10). */
export class DraftValidationError extends ValidationError {
  constructor(public readonly issues: DraftFieldIssue[]) {
    super("El borrador no es válido.");
    this.name = "DraftValidationError";
  }
}

export function listForms(organizationId: string): Promise<FormSummary[]> {
  return repository.listFormsByOrganization(organizationId);
}

/** Cubre: RF-EDT-02, CA-EDT-04 */
export function createForm(organizationId: string, input: CreateFormInput): Promise<Form> {
  return repository.createForm(organizationId, {
    name: input.name,
    draft: { title: input.name, fields: [] },
  });
}

/** Cubre: CA-EDT-05 */
export async function duplicateForm(
  organizationId: string,
  input: DuplicateFormInput,
): Promise<Form> {
  const source = await repository.findFormById(organizationId, input.sourceFormId);
  if (!source) throw new NotFoundError(FORM_NOT_FOUND);

  const draft = structuredClone(source.draftSchema) as DraftForm;
  return repository.createForm(organizationId, {
    name: input.name,
    draft: { ...draft, title: input.name },
  });
}

export async function renameForm(
  organizationId: string,
  id: string,
  input: RenameFormInput,
): Promise<Form> {
  const form = await repository.updateFormName(organizationId, id, input.name);
  if (!form) throw new NotFoundError(FORM_NOT_FOUND);
  return form;
}

/** Cubre: RF-EDT-08, RF-EDT-10, CA-EDT-07 */
export async function saveDraft(
  organizationId: string,
  id: string,
  input: SaveDraftInput,
): Promise<Form> {
  const parsed = DraftFormSchema.safeParse(input.draft);
  if (!parsed.success) {
    throw new DraftValidationError(mapDraftIssuesToFields(input.draft, parsed.error));
  }
  const form = await repository.updateFormDraft(organizationId, id, parsed.data);
  if (!form) throw new NotFoundError(FORM_NOT_FOUND);
  return form;
}

/** Cubre: CA-EDT-06 */
export async function archiveForm(organizationId: string, id: string): Promise<void> {
  const form = await repository.archiveForm(organizationId, id);
  if (!form) throw new NotFoundError(FORM_NOT_FOUND);
}
