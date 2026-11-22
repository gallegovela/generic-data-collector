import type { FileRef } from "@/lib/form-schema";

// TODO(file-storage, RF-STO-02): sustituir por una URL firmada real cuando exista el módulo.
/** Cubre: RF-SUB-08 */
export function resolvePlaceholderFileUrl(_file: FileRef, kind: "photo" | "signature"): string {
  return kind === "photo" ? "/placeholder-photo.svg" : "/placeholder-signature.svg";
}
