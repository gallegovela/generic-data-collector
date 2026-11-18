import { z } from "zod";

/**
 * Esquemas Zod del módulo tenancy-auth, compartidos entre cliente y
 * servidor (CLAUDE.md: "un mismo esquema en cliente y servidor").
 *
 * Cubre: RF-AUT-01, RF-AUT-02, RF-AUT-03, RF-AUT-04.
 */

export const loginSchema = z.object({
  email: z.string().email("Introduce un email válido."),
  password: z.string().min(1, "Introduce tu contraseña."),
});

export const requestMagicLinkSchema = z.object({
  email: z.string().email("Introduce un email válido."),
});

export const inviteUserSchema = z.object({
  email: z.string().email("Introduce un email válido."),
  role: z.enum(["admin", "collector"]),
});

export const acceptInvitationSchema = z.object({
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RequestMagicLinkInput = z.infer<typeof requestMagicLinkSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
