import { Prisma, type Form, type FormVersion } from "@prisma/client";
import { ConflictError } from "@/lib/errors";
import type { FormVersion as FormSchemaVersion } from "@/lib/form-schema";
import type { StoredConsent } from "@/lib/form-publishing/consent.schema";
import type { AccessMode } from "@/lib/form-publishing/form-publishing.schema";
import { prisma } from "@/server/db/client";

/**
 * Repositorio de publicación. Las funciones de administración reciben
 * `organizationId` y lo usan en el `where`. No hay `update` ni `delete` de
 * `FormVersion` (RF-PUB-01): las versiones son inmutables.
 */

/** El slug generado ya lo tiene otro formulario (el servicio reintenta). */
export class SlugTakenError extends Error {
  constructor() {
    super("El slug ya existe.");
    this.name = "SlugTakenError";
  }
}

export function findFormForPublishing(organizationId: string, formId: string): Promise<Form | null> {
  return prisma.form.findFirst({ where: { id: formId, organizationId, archivedAt: null } });
}

function uniqueTarget(error: unknown): string[] | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = error.meta?.target;
    if (Array.isArray(target)) return target.map(String);
    if (typeof target === "string") return [target];
    return [];
  }
  return null;
}

/**
 * Transacción: lee el Form con `organizationId`; si ya tiene slug lo conserva
 * (ignora el recibido); `version = max + 1`; crea la FormVersion y actualiza
 * el Form.
 *
 * Cubre: RF-PUB-01, RF-PUB-02, RF-PUB-04, RF-PUB-09
 */
export async function createVersionAndPublish(
  organizationId: string,
  formId: string,
  data: { schema: FormSchemaVersion; accessMode: AccessMode; slug: string; userId: string; consent?: StoredConsent | null },
): Promise<{ form: Form; version: FormVersion } | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.form.findFirst({
        where: { id: formId, organizationId, archivedAt: null },
      });
      if (!current) return null;

      const last = await tx.formVersion.aggregate({
        where: { formId },
        _max: { version: true },
      });
      const versionNumber = (last._max.version ?? 0) + 1;

      const version = await tx.formVersion.create({
        data: {
          formId,
          organizationId,
          version: versionNumber,
          schema: data.schema,
          publishedByUserId: data.userId,
          consent: data.consent ?? Prisma.DbNull,
        },
      });
      const form = await tx.form.update({
        where: { id: formId },
        data: {
          status: "published",
          slug: current.slug ?? data.slug,
          accessMode: data.accessMode,
          publishedVersion: versionNumber,
        },
      });
      return { form, version };
    });
  } catch (error) {
    const target = uniqueTarget(error);
    if (target === null) throw error;
    if (target.includes("slug") || target.some((t) => t.includes("slug"))) {
      throw new SlugTakenError();
    }
    throw new ConflictError("Se está publicando desde otro lugar. Inténtalo de nuevo.");
  }
}

async function updateOwned(
  organizationId: string,
  formId: string,
  data: Prisma.FormUpdateManyMutationInput,
): Promise<Form | null> {
  const { count } = await prisma.form.updateMany({
    where: { id: formId, organizationId, archivedAt: null },
    data,
  });
  if (count === 0) return null;
  return findFormForPublishing(organizationId, formId);
}

export function setUnpublished(organizationId: string, formId: string): Promise<Form | null> {
  return updateOwned(organizationId, formId, { status: "draft" });
}

export function setAccessMode(
  organizationId: string,
  formId: string,
  accessMode: AccessMode,
): Promise<Form | null> {
  return updateOwned(organizationId, formId, { accessMode });
}

export function findVersion(
  organizationId: string,
  formId: string,
  version: number,
): Promise<FormVersion | null> {
  return prisma.formVersion.findFirst({ where: { organizationId, formId, version } });
}

// Lectura sin sesión: se llega por slug o por id de versión.
export function findFormBySlug(
  slug: string,
): Promise<(Form & { organization: { name: string } }) | null> {
  return prisma.form.findUnique({
    where: { slug },
    include: { organization: { select: { name: true } } },
  });
}

/** Última versión del formulario con `consent` no nulo (para rellenar el panel). */
export function findLatestConsentVersion(
  organizationId: string,
  formId: string,
): Promise<FormVersion | null> {
  return prisma.formVersion.findFirst({
    where: { organizationId, formId, consent: { not: Prisma.DbNull } },
    orderBy: { version: "desc" },
  });
}

export function findVersionById(versionId: string): Promise<FormVersion | null> {
  return prisma.formVersion.findUnique({ where: { id: versionId } });
}
