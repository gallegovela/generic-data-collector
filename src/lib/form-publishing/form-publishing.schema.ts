import { z } from "zod";

export const AccessModeSchema = z.enum(["registered", "public"]);
export type AccessMode = z.infer<typeof AccessModeSchema>;

export const publishFormSchema = z.object({ accessMode: AccessModeSchema });
export type PublishFormInput = z.infer<typeof publishFormSchema>;

export const setAccessModeSchema = z.object({ accessMode: AccessModeSchema });
export type SetAccessModeInput = z.infer<typeof setAccessModeSchema>;

export const qrQuerySchema = z.object({
  format: z.enum(["png", "svg"]).default("png"),
  download: z.enum(["1"]).optional(),
});
