import { STORED_FILE_KINDS, type StoredFileKindValue } from "./file-storage.schema";
import { EXTENSION_BY_CONTENT_TYPE, type DetectedContentType } from "./file-type";

/**
 * Construcción y análisis de claves de archivo:
 * `org/<organizationId>/<kind>/<uploadId>.<ext>`.
 *
 * Cubre: RF-STO-01.
 */

export function buildFileKey(input: {
  organizationId: string;
  kind: StoredFileKindValue;
  uploadId: string;
  contentType: DetectedContentType;
}): string {
  const ext = EXTENSION_BY_CONTENT_TYPE[input.contentType];
  return `org/${input.organizationId}/${input.kind}/${input.uploadId}.${ext}`;
}

const SEGMENT = /^[A-Za-z0-9_-]+$/;
const FILE = /^([0-9a-fA-F-]{36})\.(jpg|png|webp|heic|pdf)$/;

/** null si la clave no tiene la forma esperada (no analiza permisos). */
export function parseFileKey(
  key: string,
): { organizationId: string; kind: StoredFileKindValue; uploadId: string } | null {
  const parts = key.split("/");
  if (parts.length !== 4 || parts[0] !== "org") return null;
  const [, organizationId, kind, file] = parts;
  if (!SEGMENT.test(organizationId)) return null;
  if (!(STORED_FILE_KINDS as readonly string[]).includes(kind)) return null;
  const match = FILE.exec(file);
  if (!match) return null;
  return { organizationId, kind: kind as StoredFileKindValue, uploadId: match[1] };
}
