import { z } from "zod";
import { VisibleIfSchema } from "./condition.schema";

export const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "datetime",
  "time",
  "single_choice",
  "multiple_choice",
  "yes_no",
  "photo",
  "signature",
  "gps",
  "section",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const OptionSchema = z.object({ id: z.string().min(1), label: z.string().min(1) });
export type Option = z.infer<typeof OptionSchema>;

export const FileRefSchema = z.object({
  key: z.string().min(1),
  originalName: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});
export type FileRef = z.infer<typeof FileRefSchema>;

export const GpsAnswerSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative(),
  capturedAt: z.string().datetime(),
});
export type GpsAnswer = z.infer<typeof GpsAnswerSchema>;

const baseShape = {
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean(),
  visibleIf: VisibleIfSchema.optional(),
};

const EmptyConfig = z.object({});

export const TextFieldSchema = z.object({
  ...baseShape,
  type: z.literal("text"),
  config: z.object({
    multiline: z.boolean().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    placeholder: z.string().optional(),
  }),
});
export const NumberFieldSchema = z.object({
  ...baseShape,
  type: z.literal("number"),
  config: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    decimals: z.number().int().nonnegative().optional(),
    unit: z.string().optional(),
  }),
});
export const DateFieldSchema = z.object({
  ...baseShape,
  type: z.literal("date"),
  config: z.object({ min: z.string().date().optional(), max: z.string().date().optional() }),
});
export const DateTimeFieldSchema = z.object({
  ...baseShape,
  type: z.literal("datetime"),
  config: z.object({ min: z.string().datetime().optional(), max: z.string().datetime().optional() }),
});
export const TimeFieldSchema = z.object({ ...baseShape, type: z.literal("time"), config: EmptyConfig });
export const SingleChoiceFieldSchema = z.object({
  ...baseShape,
  type: z.literal("single_choice"),
  config: z.object({
    options: z.array(OptionSchema).min(1),
    display: z.enum(["radio", "dropdown"]),
  }),
});
export const MultipleChoiceFieldSchema = z.object({
  ...baseShape,
  type: z.literal("multiple_choice"),
  config: z.object({
    options: z.array(OptionSchema).min(1),
    minSelected: z.number().int().nonnegative().optional(),
    maxSelected: z.number().int().positive().optional(),
  }),
});
export const YesNoFieldSchema = z.object({ ...baseShape, type: z.literal("yes_no"), config: EmptyConfig });
export const PhotoFieldSchema = z.object({
  ...baseShape,
  type: z.literal("photo"),
  config: z.object({
    maxPhotos: z.number().int().positive().optional(),
    allowGallery: z.boolean().optional(),
  }),
});
export const SignatureFieldSchema = z.object({
  ...baseShape,
  type: z.literal("signature"),
  config: EmptyConfig,
});
export const GpsFieldSchema = z.object({
  ...baseShape,
  type: z.literal("gps"),
  config: z.object({ autoCapture: z.boolean().optional() }),
});
export const SectionFieldSchema = z.object({
  ...baseShape,
  type: z.literal("section"),
  required: z.literal(false),
  config: EmptyConfig,
});

export const FieldSchema = z.discriminatedUnion("type", [
  TextFieldSchema,
  NumberFieldSchema,
  DateFieldSchema,
  DateTimeFieldSchema,
  TimeFieldSchema,
  SingleChoiceFieldSchema,
  MultipleChoiceFieldSchema,
  YesNoFieldSchema,
  PhotoFieldSchema,
  SignatureFieldSchema,
  GpsFieldSchema,
  SectionFieldSchema,
]);
export type Field = z.infer<typeof FieldSchema>;
