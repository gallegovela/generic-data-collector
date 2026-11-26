import type { FormVersion } from "../../src/lib/form-schema";

/** Datos de prueba de submissions-dashboard (#7). Sin dependencia de Prisma. */
export const DAILY_REPORT_FORM_TITLE = "Parte diario de obra";

export function buildDailyReportFormVersion(): FormVersion {
  return {
    schemaVersion: 1,
    title: DAILY_REPORT_FORM_TITLE,
    fields: [
      { id: "section_work", type: "section", label: "Datos de la obra", required: false, config: {} },
      { id: "site", type: "text", label: "Obra", required: true, config: {} },
      { id: "has_incidents", type: "yes_no", label: "¿Hay incidencias?", required: true, config: {} },
      { id: "notes", type: "text", label: "Observaciones", required: false, config: { multiline: true } },
      { id: "photos", type: "photo", label: "Fotos de la obra", required: false, config: { maxPhotos: 5 } },
      { id: "location", type: "gps", label: "Ubicación", required: false, config: {} },
      { id: "foreman_signature", type: "signature", label: "Firma del encargado", required: false, config: {} },
    ],
  };
}

/** Versión 2: la v1 más el campo de texto `weather` ("Tiempo"). Cubre: CA-OUT-04 */
export function buildDailyReportFormVersionV2(): FormVersion {
  const v1 = buildDailyReportFormVersion();
  return {
    ...v1,
    fields: [...v1.fields, { id: "weather", type: "text", label: "Tiempo", required: false, config: {} }],
  };
}

export type SampleSubmission = {
  formId: string;
  formTitle: string;
  clientId: string;
  formVersionSnapshot: FormVersion;
  answers: Record<string, unknown>;
  submittedByName?: string;
  capturedAt: Date;
};

/** Cinco respuestas de ejemplo de un mismo formulario; las pares tienen incidencias. */
export function buildSampleSubmissions(formId: string, prefix: string): SampleSubmission[] {
  const now = Date.now();
  return Array.from({ length: 5 }, (_, i) => ({
    formId,
    formTitle: DAILY_REPORT_FORM_TITLE,
    clientId: `${prefix}-${i}`,
    formVersionSnapshot: buildDailyReportFormVersion(),
    answers: {
      site: `Obra ${i}`,
      has_incidents: i % 2 === 0,
    },
    submittedByName: i % 2 === 0 ? "Ana Encargada" : "Luis Operario",
    capturedAt: new Date(now - i * 60_000),
  }));
}
