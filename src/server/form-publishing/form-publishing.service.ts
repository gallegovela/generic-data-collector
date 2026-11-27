import type { Form } from "@prisma/client";
import { loadEnv } from "@/lib/env";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { DEFAULT_THEME } from "@/lib/form-editor/default-theme";
import { DraftFormSchema } from "@/lib/form-editor/form-editor.schema";
import {
  CURRENT_SCHEMA_VERSION,
  FormVersionSchema,
  type FormVersion as FormSchemaVersion,
  type ThemeSnapshot,
} from "@/lib/form-schema";
import { decideAccess } from "@/lib/form-publishing/access";
import { buildFormLink } from "@/lib/form-publishing/form-link";
import type {
  AccessMode,
  PublishFormInput,
  SetAccessModeInput,
} from "@/lib/form-publishing/form-publishing.schema";
import { generateSlug, isValidSlug } from "@/lib/form-publishing/slug";
import * as repository from "./form-publishing.repository";
import { SlugTakenError } from "./form-publishing.repository";

const FORM_NOT_FOUND = "No se ha encontrado el formulario.";
const EMPTY_FORM_MESSAGE = "El formulario necesita al menos un campo para publicarse.";
const MAX_SLUG_ATTEMPTS = 5;

export type PublishedFormView = {
  formId: string;
  organizationId: string;
  name: string;
  slug: string;
  accessMode: AccessMode;
  versionId: string;
  version: number;
  schema: FormSchemaVersion;
  theme: ThemeSnapshot;
};

export type FormLookup = { state: "published"; form: PublishedFormView } | { state: "closed" };

export type StoredFormVersion = {
  id: string;
  formId: string;
  organizationId: string;
  version: number;
  schema: FormSchemaVersion;
  createdAt: Date;
};

export type PublishingState = {
  status: "draft" | "published";
  slug: string | null;
  accessMode: AccessMode;
  publishedVersion: number | null;
  link: string | null;
};

export class PublishValidationError extends ValidationError {
  constructor(public readonly issues: { path: string; message: string }[]) {
    super(issues[0]?.message ?? "El formulario no se puede publicar.");
    this.name = "PublishValidationError";
  }
}

/**
 * Publica el borrador como una `FormVersion` inmutable.
 *
 * Cubre: RF-PUB-01, RF-PUB-09, RF-PUB-11, CA-PUB-01, CA-PUB-05, CA-PUB-07
 */
export async function publishForm(
  organizationId: string,
  userId: string,
  formId: string,
  input: PublishFormInput,
): Promise<{ version: number; slug: string; link: string }> {
  const form = await repository.findFormForPublishing(organizationId, formId);
  if (!form) throw new NotFoundError(FORM_NOT_FOUND);

  const draft = DraftFormSchema.safeParse(form.draftSchema);
  if (!draft.success) {
    throw new PublishValidationError(
      draft.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }

  const candidate = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: draft.data.title,
    ...(draft.data.description !== undefined ? { description: draft.data.description } : {}),
    fields: draft.data.fields,
  };
  const parsed = FormVersionSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new PublishValidationError(
      parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: draft.data.fields.length === 0 ? EMPTY_FORM_MESSAGE : i.message,
      })),
    );
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = form.slug ?? generateSlug();
    try {
      const result = await repository.createVersionAndPublish(organizationId, formId, {
        schema: parsed.data,
        accessMode: input.accessMode,
        slug,
        userId,
      });
      if (!result) throw new NotFoundError(FORM_NOT_FOUND);
      const finalSlug = result.form.slug ?? slug;
      return {
        version: result.version.version,
        slug: finalSlug,
        link: buildFormLink(loadEnv().AUTH_URL, finalSlug),
      };
    } catch (error) {
      if (!(error instanceof SlugTakenError)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

/** Cubre: RF-PUB-06, CA-PUB-05, CA-PUB-06 */
export async function unpublishForm(organizationId: string, formId: string): Promise<void> {
  const form = await repository.setUnpublished(organizationId, formId);
  if (!form) throw new NotFoundError(FORM_NOT_FOUND);
}

/** Cubre: RF-PUB-09, CA-PUB-05 */
export async function setFormAccessMode(
  organizationId: string,
  formId: string,
  input: SetAccessModeInput,
): Promise<void> {
  const form = await repository.setAccessMode(organizationId, formId, input.accessMode);
  if (!form) throw new NotFoundError(FORM_NOT_FOUND);
}

function toPublishingState(form: Form): PublishingState {
  return {
    status: form.status,
    slug: form.slug,
    accessMode: form.accessMode,
    publishedVersion: form.publishedVersion,
    link: form.slug ? buildFormLink(loadEnv().AUTH_URL, form.slug) : null,
  };
}

export async function getPublishingState(
  organizationId: string,
  formId: string,
): Promise<PublishingState> {
  const form = await repository.findFormForPublishing(organizationId, formId);
  if (!form) throw new NotFoundError(FORM_NOT_FOUND);
  return toPublishingState(form);
}

/**
 * Contrato de lectura sin sesión.
 *
 * Cubre: RF-PUB-04, RF-PUB-10
 */
export async function getPublishedFormBySlug(slug: string): Promise<FormLookup> {
  if (!isValidSlug(slug)) throw new NotFoundError(FORM_NOT_FOUND);
  const form = await repository.findFormBySlug(slug);
  if (!form) throw new NotFoundError(FORM_NOT_FOUND);
  if (form.status !== "published" || form.archivedAt !== null || form.publishedVersion === null) {
    return { state: "closed" };
  }

  const stored = await repository.findVersion(form.organizationId, form.id, form.publishedVersion);
  if (!stored) return { state: "closed" };

  return {
    state: "published",
    form: {
      formId: form.id,
      organizationId: form.organizationId,
      name: form.name,
      slug,
      accessMode: form.accessMode,
      versionId: stored.id,
      version: stored.version,
      schema: FormVersionSchema.parse(stored.schema),
      // TODO(theming): sustituir por el tema real de la organización
      theme: DEFAULT_THEME,
    },
  };
}

/**
 * Como `getPublishedFormBySlug` pero aplicando el modo de acceso. El cierre
 * se evalúa antes que el acceso.
 *
 * Cubre: CA-PUB-04
 */
export async function getFormForFilling(
  slug: string,
  user: { organizationId: string } | null,
): Promise<FormLookup> {
  const lookup = await getPublishedFormBySlug(slug);
  if (lookup.state === "closed") return lookup;

  const decision = decideAccess(lookup.form.accessMode, lookup.form.organizationId, user);
  if (decision === "login-required") throw new UnauthorizedError();
  if (decision === "forbidden") {
    throw new ForbiddenError("No tienes acceso a este formulario.");
  }
  return lookup;
}

/**
 * Cualquier versión por id, con independencia del estado del formulario.
 *
 * Cubre: RF-PUB-03, RF-PUB-08, CA-PUB-03
 */
export async function getFormVersion(versionId: string): Promise<StoredFormVersion | null> {
  const stored = await repository.findVersionById(versionId);
  if (!stored) return null;
  return {
    id: stored.id,
    formId: stored.formId,
    organizationId: stored.organizationId,
    version: stored.version,
    schema: FormVersionSchema.parse(stored.schema),
    createdAt: stored.createdAt,
  };
}

/**
 * Formularios publicados de la organización (listado de `/forms`).
 *
 * Cubre: RF-AUT-09
 */
export function listPublishedFormsForOrg(
  organizationId: string,
): Promise<repository.PublishedFormRow[]> {
  return repository.listPublishedForms(organizationId);
}
