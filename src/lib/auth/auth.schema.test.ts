import { describe, expect, it } from "vitest";
import {
  acceptInvitationSchema,
  inviteUserSchema,
  loginSchema,
  requestMagicLinkSchema,
} from "./auth.schema";

describe("loginSchema", () => {
  // Cubre: RF-AUT-01
  it("acepta un email y una contraseña válidos", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "secreto" });

    expect(result.success).toBe(true);
  });

  it("rechaza un email mal formado", () => {
    const result = loginSchema.safeParse({ email: "no-es-un-email", password: "secreto" });

    expect(result.success).toBe(false);
  });

  it("rechaza una contraseña vacía", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "" });

    expect(result.success).toBe(false);
  });
});

describe("requestMagicLinkSchema", () => {
  // Cubre: RF-AUT-02
  it("acepta un email válido", () => {
    expect(requestMagicLinkSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });

  it("rechaza un email mal formado", () => {
    expect(requestMagicLinkSchema.safeParse({ email: "no-es-un-email" }).success).toBe(false);
  });
});

describe("inviteUserSchema", () => {
  // Cubre: RF-AUT-04
  it("acepta un email y un rol válidos", () => {
    const result = inviteUserSchema.safeParse({ email: "a@b.com", role: "admin" });

    expect(result.success).toBe(true);
  });

  it("rechaza un rol fuera de la lista", () => {
    const result = inviteUserSchema.safeParse({ email: "a@b.com", role: "superadmin" });

    expect(result.success).toBe(false);
  });

  it("rechaza un email mal formado", () => {
    const result = inviteUserSchema.safeParse({ email: "no-es-un-email", role: "collector" });

    expect(result.success).toBe(false);
  });
});

describe("acceptInvitationSchema", () => {
  it("acepta una contraseña de al menos 8 caracteres", () => {
    expect(acceptInvitationSchema.safeParse({ password: "12345678" }).success).toBe(true);
  });

  it("rechaza una contraseña corta", () => {
    expect(acceptInvitationSchema.safeParse({ password: "1234567" }).success).toBe(false);
  });
});
