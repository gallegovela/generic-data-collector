import type { Field, FieldType } from "@/lib/form-schema";

export type FieldPaletteEntry = {
  type: FieldType;
  label: string; // etiqueta en español para la paleta
  icon: string; // nombre del icono de lucide-react
  buildDefaultField: (id: string) => Field;
};

const optionsDefault = [
  { id: "opcion-1", label: "Opción 1" },
  { id: "opcion-2", label: "Opción 2" },
];

export const FIELD_PALETTE: readonly FieldPaletteEntry[] = [
  {
    type: "text",
    label: "Texto",
    icon: "Type",
    buildDefaultField: (id) => ({ id, type: "text", label: "Texto", required: false, config: {} }),
  },
  {
    type: "number",
    label: "Número",
    icon: "Hash",
    buildDefaultField: (id) => ({ id, type: "number", label: "Número", required: false, config: {} }),
  },
  {
    type: "date",
    label: "Fecha",
    icon: "Calendar",
    buildDefaultField: (id) => ({ id, type: "date", label: "Fecha", required: false, config: {} }),
  },
  {
    type: "datetime",
    label: "Fecha y hora",
    icon: "CalendarClock",
    buildDefaultField: (id) => ({
      id,
      type: "datetime",
      label: "Fecha y hora",
      required: false,
      config: {},
    }),
  },
  {
    type: "time",
    label: "Hora",
    icon: "Clock",
    buildDefaultField: (id) => ({ id, type: "time", label: "Hora", required: false, config: {} }),
  },
  {
    type: "single_choice",
    label: "Selección única",
    icon: "CircleDot",
    buildDefaultField: (id) => ({
      id,
      type: "single_choice",
      label: "Selección única",
      required: false,
      config: { options: optionsDefault.map((o) => ({ ...o })), display: "radio" },
    }),
  },
  {
    type: "multiple_choice",
    label: "Selección múltiple",
    icon: "ListChecks",
    buildDefaultField: (id) => ({
      id,
      type: "multiple_choice",
      label: "Selección múltiple",
      required: false,
      config: { options: optionsDefault.map((o) => ({ ...o })) },
    }),
  },
  {
    type: "yes_no",
    label: "Sí / No",
    icon: "ToggleLeft",
    buildDefaultField: (id) => ({ id, type: "yes_no", label: "Sí / No", required: false, config: {} }),
  },
  {
    type: "photo",
    label: "Foto",
    icon: "Camera",
    buildDefaultField: (id) => ({ id, type: "photo", label: "Foto", required: false, config: {} }),
  },
  {
    type: "signature",
    label: "Firma",
    icon: "PenLine",
    buildDefaultField: (id) => ({
      id,
      type: "signature",
      label: "Firma",
      required: false,
      config: {},
    }),
  },
  {
    type: "gps",
    label: "Ubicación GPS",
    icon: "MapPin",
    buildDefaultField: (id) => ({ id, type: "gps", label: "Ubicación", required: false, config: {} }),
  },
  {
    type: "section",
    label: "Sección o título",
    icon: "Heading",
    buildDefaultField: (id) => ({
      id,
      type: "section",
      label: "Nueva sección",
      required: false,
      config: {},
    }),
  },
];
