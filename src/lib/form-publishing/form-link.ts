/**
 * `${baseUrl sin barra final}/f/${slug}`.
 *
 * Cubre: RF-PUB-04, CA-PUB-02
 */
export function buildFormLink(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/f/${slug}`;
}
