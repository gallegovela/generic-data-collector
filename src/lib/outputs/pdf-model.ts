import type { Submission } from "@prisma/client";
import { FormVersionSchema, type Field } from "@/lib/form-schema";
import { isOwnFileKey } from "@/lib/submissions-dashboard/create-submission.schema";

export type PdfImageRef = { key: string };
export type PdfEntry =
  | { kind: "section"; label: string }
  | { kind: "text"; label: string; value: string }
  | { kind: "images"; label: string; images: PdfImageRef[]; omitted: number };

export type PdfTheme = { primaryColor: string; secondaryColor: string; logo: PdfImageRef | null };

export type PdfModel = {
  organizationName: string;
  formTitle: string;
  versionLabel: string;
  capturedAt: string;
  syncedAt: string;
  submittedByName: string | null;
  theme: PdfTheme;
  entries: PdfEntry[];
  viewUrl: string;
};

export const MAX_PDF_IMAGES = 12;
export const DEFAULT_PRIMARY_COLOR = "#1f2937";
export const DEFAULT_SECONDARY_COLOR = "#6b7280";
const EMPTY = "—";
const HEX = /^#[0-9a-fA-F]{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFileRef(value: unknown): value is { key: string } {
  return isRecord(value) && typeof value.key === "string";
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(",", "");
}

/**
 * theme del snapshot -> colores válidos (#rrggbb) o por defecto; `logoKey`
 * solo si es una clave de archivo de la organización.
 *
 * Cubre: RF-OUT-03
 */
export function resolvePdfTheme(snapshot: unknown, organizationId: string): PdfTheme {
  const theme = isRecord(snapshot) && isRecord(snapshot.theme) ? snapshot.theme : {};
  const color = (value: unknown, fallback: string): string =>
    typeof value === "string" && HEX.test(value) ? value : fallback;
  const logoKey = theme.logoKey;
  return {
    primaryColor: color(theme.primaryColor, DEFAULT_PRIMARY_COLOR),
    secondaryColor: color(theme.secondaryColor, DEFAULT_SECONDARY_COLOR),
    logo:
      typeof logoKey === "string" && isOwnFileKey(organizationId, logoKey)
        ? { key: logoKey }
        : null,
  };
}

function optionLabel(field: Extract<Field, { type: "single_choice" | "multiple_choice" }>, id: string): string {
  return field.config.options.find((o) => o.id === id)?.label ?? id;
}

function entryFor(field: Field, value: unknown): PdfEntry {
  const label = field.label;
  const text = (v: string): PdfEntry => ({ kind: "text", label, value: v === "" ? EMPTY : v });
  if (field.type === "section") return { kind: "section", label };
  if (value === undefined || value === null) return text(EMPTY);

  switch (field.type) {
    case "number":
    case "text":
    case "date":
    case "datetime":
    case "time":
      return text(String(value));
    case "single_choice":
      return text(optionLabel(field, String(value)));
    case "multiple_choice":
      return Array.isArray(value) && value.length > 0
        ? text(value.map((v) => optionLabel(field, String(v))).join(", "))
        : text(EMPTY);
    case "yes_no":
      return text(typeof value === "boolean" ? (value ? "Sí" : "No") : EMPTY);
    case "photo": {
      const refs = Array.isArray(value) ? value.filter(isFileRef) : [];
      if (refs.length === 0) return text(EMPTY);
      return {
        kind: "images",
        label,
        images: refs.slice(0, MAX_PDF_IMAGES).map((r) => ({ key: r.key })),
        omitted: Math.max(0, refs.length - MAX_PDF_IMAGES),
      };
    }
    case "signature":
      return isFileRef(value)
        ? { kind: "images", label, images: [{ key: value.key }], omitted: 0 }
        : text(EMPTY);
    case "gps": {
      if (!isRecord(value) || typeof value.lat !== "number" || typeof value.lng !== "number") {
        return text(EMPTY);
      }
      return text(`${value.lat}, ${value.lng}`);
    }
  }
}

/**
 * Sin E/S. Recorre los campos del snapshot en orden; omite los que no
 * están en `answers` (ocultos) y muestra las secciones como título. El
 * máximo de imágenes por PDF es 12 (el resto se cuenta en `omitted`).
 * Si el snapshot no valida, lista las claves de `answers` como texto.
 *
 * Cubre: RF-OUT-03
 */
export function buildPdfModel(input: {
  organizationName: string;
  submission: Submission;
  baseUrl: string;
}): PdfModel {
  const { organizationName, submission, baseUrl } = input;
  const answers = isRecord(submission.answers) ? submission.answers : {};
  const parsed = FormVersionSchema.safeParse(submission.formVersionSnapshot);

  const entries: PdfEntry[] = [];
  let imagesLeft = MAX_PDF_IMAGES;
  if (parsed.success) {
    for (const field of parsed.data.fields) {
      if (field.type !== "section" && !(field.id in answers)) continue;
      const entry = entryFor(field, answers[field.id]);
      if (entry.kind === "images") {
        const kept = entry.images.slice(0, imagesLeft);
        const omitted = entry.omitted + (entry.images.length - kept.length);
        imagesLeft -= kept.length;
        entries.push(
          kept.length === 0
            ? { kind: "text", label: entry.label, value: `${omitted} imagen(es) no incluida(s)` }
            : { ...entry, images: kept, omitted },
        );
      } else {
        entries.push(entry);
      }
    }
  } else {
    for (const [key, value] of Object.entries(answers)) {
      entries.push({
        kind: "text",
        label: key,
        value: typeof value === "string" ? value : JSON.stringify(value) ?? EMPTY,
      });
    }
  }

  return {
    organizationName,
    formTitle: submission.formTitle,
    versionLabel:
      submission.formVersionNumber === null
        ? "Versión desconocida"
        : `Versión ${submission.formVersionNumber}`,
    capturedAt: formatDate(submission.capturedAt),
    syncedAt: formatDate(submission.syncedAt),
    submittedByName: submission.submittedByName,
    theme: resolvePdfTheme(submission.formVersionSnapshot, submission.organizationId),
    entries,
    viewUrl: `${baseUrl.replace(/\/+$/, "")}/admin/forms/${submission.formId}/submissions/${submission.id}`,
  };
}
