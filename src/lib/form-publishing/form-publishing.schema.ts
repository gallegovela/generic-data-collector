import { z } from "zod";
import { ConsentInputSchema } from "./consent.schema";

export const AccessModeSchema = z.enum(["registered", "public"]);
export type AccessMode = z.infer<typeof AccessModeSchema>;

/**
 * Con `registered`, `consent` se ignora (no se guarda).
 *
 * Cubre: RF-PUB-12, CA-PUB-08
 */
export const publishFormSchema = z
  .object({ accessMode: AccessModeSchema, consent: ConsentInputSchema.optional() })
  .superRefine((value, ctx) => {
    if (value.accessMode === "public" && !value.consent) {
      ctx.addIssue({
        code: "custom",
        path: ["consent"],
        message: "Un formulario público necesita términos y condiciones.",
      });
    }
  });
export type PublishFormInput = z.input<typeof publishFormSchema>;

export const setAccessModeSchema = z.object({ accessMode: AccessModeSchema });
export type SetAccessModeInput = z.infer<typeof setAccessModeSchema>;

export const qrQuerySchema = z.object({
  format: z.enum(["png", "svg"]).default("png"),
  download: z.enum(["1"]).optional(),
});
