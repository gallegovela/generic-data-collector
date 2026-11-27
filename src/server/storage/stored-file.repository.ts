import { Prisma, type StoredFileKind } from "@prisma/client";
import { prisma } from "@/server/db/client";

// Todas las consultas llevan organizationId (RNF-STO-01), salvo
// findOrphanFiles, que usa un script de mantenimiento y nunca una ruta HTTP.

export type StoredFileRecord = {
  id: string;
  organizationId: string;
  key: string;
  uploadId: string;
  kind: StoredFileKind;
  contentType: string;
  sizeBytes: number;
  submissionId: string | null;
  createdAt: Date;
};

export function findByUploadId(
  organizationId: string,
  uploadId: string,
): Promise<StoredFileRecord | null> {
  return prisma.storedFile.findUnique({
    where: { organizationId_uploadId: { organizationId, uploadId } },
  });
}

export function findByKey(
  organizationId: string,
  key: string,
): Promise<StoredFileRecord | null> {
  return prisma.storedFile.findFirst({ where: { organizationId, key } });
}

/** Inserta; si ya existe (organizationId, uploadId) (P2002) devuelve el existente y created=false. */
export async function createIfAbsent(
  organizationId: string,
  data: {
    key: string;
    uploadId: string;
    kind: StoredFileKind;
    contentType: string;
    sizeBytes: number;
  },
): Promise<{ record: StoredFileRecord; created: boolean }> {
  try {
    const record = await prisma.storedFile.create({ data: { organizationId, ...data } });
    return { record, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await findByUploadId(organizationId, data.uploadId);
      if (existing) return { record: existing, created: false };
    }
    throw error;
  }
}

/**
 * Marca los archivos como parte de una respuesta. Devuelve cuántos actualizó
 * (solo de esa organización). Un archivo ya enlazado a otra respuesta nunca se
 * reasigna (RF-COL-18); si ya es de esta misma, no cambia nada.
 */
export async function linkToSubmission(
  organizationId: string,
  keys: string[],
  submissionId: string,
): Promise<number> {
  const result = await prisma.storedFile.updateMany({
    where: {
      organizationId,
      key: { in: keys },
      OR: [{ submissionId: null }, { submissionId }],
    },
    data: { submissionId },
  });
  return result.count;
}

/** RF-STO-07: submissionId null y createdAt < cutoff. Para el script de #24. */
export function findOrphanFiles(
  cutoff: Date,
  organizationId?: string,
): Promise<StoredFileRecord[]> {
  return prisma.storedFile.findMany({
    where: {
      submissionId: null,
      createdAt: { lt: cutoff },
      ...(organizationId ? { organizationId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}
