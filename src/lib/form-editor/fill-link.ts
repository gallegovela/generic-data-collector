import type { FormStatus } from "@prisma/client";

export const FILL_UNAVAILABLE_REASON = "Publica el formulario para poder rellenarlo";

export type FillAction = { available: true; href: string } | { available: false; reason: string };

/**
 * Acción «Rellenar» del listado: solo para formularios publicados con `slug`.
 *
 * Cubre: RF-EDT-13, CA-EDT-13, CA-EDT-14
 */
export function getFillAction(form: { status: FormStatus; slug: string | null }): FillAction {
  if (form.status === "published" && form.slug !== null) {
    return { available: true, href: `/f/${form.slug}` };
  }
  return { available: false, reason: FILL_UNAVAILABLE_REASON };
}
