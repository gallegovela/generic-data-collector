import { getEnv } from "@/lib/env";
import {
  ConflictError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "@/lib/errors";
import { buildFileKey } from "@/lib/file-storage/file-key";
import {
  ALLOWED_CONTENT_TYPES,
  type StoredFileKindValue,
} from "@/lib/file-storage/file-storage.schema";
import { detectFileType } from "@/lib/file-storage/file-type";
import { getStorageAdapter } from "./storage-adapter";
import {
  createIfAbsent,
  findByKey,
  findByUploadId,
  linkToSubmission,
  type StoredFileRecord,
} from "./stored-file.repository";

export const MAX_SIGNED_URL_TTL_SECONDS = 900;

export type UploadedFile = {
  key: string;
  kind: StoredFileKindValue;
  contentType: string;
  sizeBytes: number;
};

function toUploaded(record: StoredFileRecord): UploadedFile {
  return {
    key: record.key,
    kind: record.kind,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
  };
}

const KIND_CONFLICT = "Ese identificador de subida ya se usó con otro tipo de archivo.";

/**
 * Sube y registra. Idempotente por (organizationId, uploadId).
 *
 * Cubre: RF-STO-01, RF-STO-04, RF-STO-06, RF-STO-10, RF-STO-11.
 */
export async function uploadFile(
  organizationId: string,
  input: { kind: StoredFileKindValue; uploadId: string; bytes: Uint8Array },
): Promise<{ file: UploadedFile; created: boolean }> {
  const { bytes, kind, uploadId } = input;

  if (bytes.byteLength === 0) {
    throw new ValidationError("El archivo está vacío.");
  }
  if (bytes.byteLength > getEnv().STORAGE_MAX_UPLOAD_BYTES) {
    throw new PayloadTooLargeError();
  }

  const contentType = detectFileType(bytes);
  if (!contentType || !ALLOWED_CONTENT_TYPES[kind].includes(contentType)) {
    throw new UnsupportedMediaTypeError();
  }

  const existing = await findByUploadId(organizationId, uploadId);
  if (existing) {
    if (existing.kind !== kind) throw new ConflictError(KIND_CONFLICT);
    return { file: toUploaded(existing), created: false };
  }

  const key = buildFileKey({ organizationId, kind, uploadId, contentType });
  const adapter = getStorageAdapter();
  await adapter.put({ key, body: bytes, contentType });

  let result;
  try {
    result = await createIfAbsent(organizationId, {
      key,
      uploadId,
      kind,
      contentType,
      sizeBytes: bytes.byteLength,
    });
  } catch (error) {
    await adapter.delete(key).catch(() => undefined);
    throw error;
  }

  if (!result.created) {
    // Subida simultánea con el mismo uploadId: si la clave difiere (otro
    // tipo detectado → otra extensión) el objeto recién escrito sobra.
    if (result.record.key !== key) {
      await adapter.delete(key).catch(() => undefined);
    }
    if (result.record.kind !== kind) {
      if (result.record.key === key) await adapter.delete(key).catch(() => undefined);
      throw new ConflictError(KIND_CONFLICT);
    }
    return { file: toUploaded(result.record), created: false };
  }

  // RNF-STO-04: solo clave y tamaño, nunca contenido ni nombre original.
  console.log(JSON.stringify({ event: "file.uploaded", key, sizeBytes: bytes.byteLength }));

  return { file: toUploaded(result.record), created: true };
}

/**
 * Cubre: RF-STO-02, RF-STO-03, RF-STO-09. NotFoundError si la clave no
 * existe o es de otra organización (mismo error en ambos casos).
 */
export async function getSignedFileUrl(
  organizationId: string,
  key: string,
): Promise<{ url: string; expiresInSeconds: number }> {
  const record = await findByKey(organizationId, key);
  if (!record) throw new NotFoundError("No se ha encontrado el archivo.");

  const expiresInSeconds = Math.min(
    getEnv().STORAGE_SIGNED_URL_TTL_SECONDS,
    MAX_SIGNED_URL_TTL_SECONDS,
  );
  const url = await getStorageAdapter().getSignedUrl(key, expiresInSeconds);
  return { url, expiresInSeconds };
}

/**
 * Lee el contenido de un archivo en el servidor (p. ej. para el PDF). No
 * genera URL. NotFoundError si la clave no está registrada en la
 * organización (mismo error si es de otra).
 *
 * Cubre: RF-OUT-03
 */
export async function readFileBytes(
  organizationId: string,
  key: string,
): Promise<{ bytes: Uint8Array; contentType: string; sizeBytes: number }> {
  const record = await findByKey(organizationId, key);
  if (!record) throw new NotFoundError("No se ha encontrado el archivo.");
  const bytes = await getStorageAdapter().get(key);
  return { bytes, contentType: record.contentType, sizeBytes: record.sizeBytes };
}

/** Para field-collector: enlaza claves a una respuesta. */
export function attachFilesToSubmission(
  organizationId: string,
  keys: string[],
  submissionId: string,
): Promise<number> {
  return linkToSubmission(organizationId, keys, submissionId);
}
