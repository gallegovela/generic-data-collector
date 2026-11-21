import { z } from "zod";

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const ThemeSnapshotSchema = z.object({
  primaryColor: HexColor.optional(),
  secondaryColor: HexColor.optional(),
  fontFamily: z.string().optional(),
  logoKey: z.string().optional(),
});
export type ThemeSnapshot = z.infer<typeof ThemeSnapshotSchema>;
