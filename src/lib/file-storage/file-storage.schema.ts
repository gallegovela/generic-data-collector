import { z } from "zod";
import type { DetectedContentType } from "./file-type";

/**
 * Esquemas y constantes de file-storage.
 *
 * Cubre: RF-STO-04, RF-STO-09, RF-STO-10.
 */

export const STORED_FILE_KINDS = ["photo", "signature", "document"] as const;
export type StoredFileKindValue = (typeof STORED_FILE_KINDS)[number];

/** Tipos admitidos por tipo de archivo (RF-STO-04). */
export const ALLOWED_CONTENT_TYPES: Record<
  StoredFileKindValue,
  readonly DetectedContentType[]
> = {
  photo: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  signature: ["image/png"],
  document: ["application/pdf"],
};

export const uploadInputSchema = z.object({
  kind: z.enum(STORED_FILE_KINDS),
  uploadId: z.string().uuid(),
});
export type UploadInput = z.infer<typeof uploadInputSchema>;

export const fileKeyQuerySchema = z.object({ key: z.string().min(1).max(300) });
