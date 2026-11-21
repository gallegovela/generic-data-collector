import type { FormVersion } from "../form-version.schema";

export const dailyConstructionReportForm: FormVersion = {
  schemaVersion: 1,
  title: "Parte diario de obra",
  description: "Registro diario de la actividad en obra.",
  fields: [
    { id: "date", type: "date", label: "Fecha", required: true, config: {} },
    { id: "site", type: "text", label: "Obra", required: true, config: { maxLength: 200 } },
    { id: "section_work", type: "section", label: "Trabajos realizados", required: false, config: {} },
    { id: "work_done", type: "text", label: "Descripción de los trabajos", required: true, config: { multiline: true } },
    { id: "workers", type: "number", label: "Operarios presentes", required: true, config: { min: 0, decimals: 0 } },
    { id: "incident", type: "yes_no", label: "¿Hubo alguna incidencia?", required: true, config: {} },
    {
      id: "incident_detail",
      type: "text",
      label: "Detalle de la incidencia",
      required: true,
      visibleIf: { fieldId: "incident", operator: "equals", value: true },
      config: { multiline: true },
    },
    { id: "photos", type: "photo", label: "Fotos de la obra", required: false, config: { maxPhotos: 10, allowGallery: true } },
    { id: "location", type: "gps", label: "Ubicación", required: false, config: { autoCapture: true } },
    { id: "foreman_signature", type: "signature", label: "Firma del encargado", required: true, config: {} },
  ],
};

export const customerSatisfactionSurveyForm: FormVersion = {
  schemaVersion: 1,
  title: "Encuesta de satisfacción de cliente",
  fields: [
    {
      id: "rating",
      type: "single_choice",
      label: "¿Cómo valora nuestro servicio?",
      required: true,
      config: {
        display: "radio",
        options: [
          { id: "bad", label: "Malo" },
          { id: "ok", label: "Correcto" },
          { id: "good", label: "Bueno" },
          { id: "great", label: "Excelente" },
        ],
      },
    },
    {
      id: "aspects",
      type: "multiple_choice",
      label: "¿Qué aspectos mejoraría?",
      required: false,
      config: {
        options: [
          { id: "price", label: "Precio" },
          { id: "speed", label: "Rapidez" },
          { id: "support", label: "Atención" },
        ],
      },
    },
    {
      id: "comments",
      type: "text",
      label: "Comentarios",
      required: false,
      visibleIf: { fieldId: "aspects", operator: "isAnswered" },
      config: { multiline: true, maxLength: 1000 },
    },
    { id: "recommend", type: "yes_no", label: "¿Nos recomendaría?", required: true, config: {} },
  ],
};

export const clientOnboardingForm: FormVersion = {
  schemaVersion: 1,
  title: "Alta de cliente para gestoría",
  fields: [
    { id: "section_personal", type: "section", label: "Datos personales", required: false, config: {} },
    { id: "full_name", type: "text", label: "Nombre y apellidos", required: true, config: {} },
    { id: "tax_id", type: "text", label: "NIF/NIE", required: true, config: { maxLength: 15 } },
    { id: "birth_date", type: "date", label: "Fecha de nacimiento", required: false, config: {} },
    {
      id: "client_type",
      type: "single_choice",
      label: "Tipo de cliente",
      required: true,
      config: {
        display: "dropdown",
        options: [
          { id: "freelancer", label: "Autónomo" },
          { id: "company", label: "Empresa" },
        ],
      },
    },
    {
      id: "company_name",
      type: "text",
      label: "Razón social",
      required: true,
      visibleIf: { fieldId: "client_type", operator: "equals", value: "company" },
      config: {},
    },
    { id: "section_docs", type: "section", label: "Documentación", required: false, config: {} },
    { id: "id_photo", type: "photo", label: "Foto del documento de identidad", required: true, config: { maxPhotos: 2 } },
    { id: "signature", type: "signature", label: "Firma del cliente", required: true, config: {} },
  ],
};

export const demoForms: readonly FormVersion[] = [
  dailyConstructionReportForm,
  customerSatisfactionSurveyForm,
  clientOnboardingForm,
];
