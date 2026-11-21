import { z } from "zod";
import { FileRefSchema, GpsAnswerSchema, type Field } from "./field.schema";

function withRange(
  base: z.ZodString,
  min: string | undefined,
  max: string | undefined,
  noun: string,
): z.ZodType<string> {
  return base.superRefine((value, ctx) => {
    if (min && value < min) {
      ctx.addIssue({ code: "custom", message: `${noun} debe ser posterior o igual a "${min}".` });
    }
    if (max && value > max) {
      ctx.addIssue({ code: "custom", message: `${noun} debe ser anterior o igual a "${max}".` });
    }
  });
}

export function buildFieldAnswerSchema(field: Field): z.ZodType<unknown> {
  switch (field.type) {
    case "text": {
      let s = z.string();
      if (field.config.minLength !== undefined) s = s.min(field.config.minLength);
      if (field.config.maxLength !== undefined) s = s.max(field.config.maxLength);
      return s;
    }
    case "number": {
      let s = z.number();
      if (field.config.min !== undefined) s = s.min(field.config.min);
      if (field.config.max !== undefined) s = s.max(field.config.max);
      return s;
    }
    case "date":
      return withRange(z.string().date(), field.config.min, field.config.max, "La fecha");
    case "datetime":
      return withRange(z.string().datetime(), field.config.min, field.config.max, "La fecha y hora");
    case "time":
      return z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
    case "single_choice": {
      const ids = new Set(field.config.options.map((o) => o.id));
      return z.string().refine((v) => ids.has(v), { message: "Opción no válida." });
    }
    case "multiple_choice": {
      const ids = new Set(field.config.options.map((o) => o.id));
      let s = z.array(z.string().refine((v) => ids.has(v), { message: "Opción no válida." }));
      if (field.config.minSelected !== undefined) s = s.min(field.config.minSelected);
      if (field.config.maxSelected !== undefined) s = s.max(field.config.maxSelected);
      return s;
    }
    case "yes_no":
      return z.boolean();
    case "photo":
      return z.array(FileRefSchema).max(field.config.maxPhotos ?? Infinity);
    case "signature":
      return FileRefSchema;
    case "gps":
      return GpsAnswerSchema;
    case "section":
      throw new Error("section no tiene respuesta");
  }
}
