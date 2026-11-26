import type { FileRef } from "@/lib/form-schema";

// TODO(file-storage, RF-STO-02): ajustar a la ruta real autenticada cuando exista el módulo.
/** `${baseUrl}/api/files/${encodeURIComponent(file.key)}`; sin barra final en baseUrl. Cubre: RF-OUT-06 */
export function buildFileExportLink(baseUrl: string, file: FileRef): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/files/${encodeURIComponent(file.key)}`;
}
