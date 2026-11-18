import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { RateLimitError, UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/server/db/client";

vi.mock("@/server/integrations/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendEmail } from "@/server/integrations/email";
import { createOrganization } from "./organization.repository";
import { createLoginToken } from "./login-token.repository";
import { createUser } from "./user.repository";
import {
  hashPassword,
  requestMagicLink,
  verifyMagicLink,
  verifyPassword,
} from "./auth.service";

describe("auth.service", () => {
  let organization: { id: string };

  beforeAll(async () => {
    organization = await createOrganization({ name: "Organización auth.service (test)" });
  });

  afterAll(async () => {
    await prisma.loginToken.deleteMany({ where: { user: { organizationId: organization.id } } });
    await prisma.user.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
  });

  async function createActiveUser(email: string, password: string) {
    const passwordHash = await hashPassword(password);
    return createUser(organization.id, { email, name: "Usuario de prueba", role: "collector", passwordHash });
  }

  // Cubre: RF-AUT-01, CA-AUT-04, RNF-AUT-01
  it("hashPassword produce un hash distinto del texto plano y verificable", async () => {
    const hash = await hashPassword("Demo1234!");

    expect(hash).not.toBe("Demo1234!");

    const email = `hash-check-${Date.now()}@test.formia.local`;
    await createUser(organization.id, { email, name: "Hash", role: "collector", passwordHash: hash });

    const user = await verifyPassword(email, "Demo1234!");
    expect(user.email).toBe(email);
  });

  // Cubre: RF-AUT-01, CA-AUT-04
  it("verifyPassword devuelve CurrentUser con la contraseña correcta", async () => {
    const email = `correct-${Date.now()}@test.formia.local`;
    await createActiveUser(email, "Demo1234!");

    const user = await verifyPassword(email, "Demo1234!");

    expect(user).toMatchObject({ email, organizationId: organization.id, role: "collector" });
  });

  // Cubre: RF-AUT-01, CA-AUT-04
  it("verifyPassword lanza UnauthorizedError con la contraseña incorrecta", async () => {
    const email = `incorrect-${Date.now()}@test.formia.local`;
    await createActiveUser(email, "Demo1234!");

    await expect(verifyPassword(email, "contraseña-incorrecta")).rejects.toThrow(UnauthorizedError);
  });

  // Cubre: RF-AUT-01, CA-AUT-04
  it("verifyPassword lanza UnauthorizedError con un usuario inactive", async () => {
    const email = `inactive-${Date.now()}@test.formia.local`;
    const user = await createActiveUser(email, "Demo1234!");
    await prisma.user.update({ where: { id: user.id }, data: { status: "inactive" } });

    await expect(verifyPassword(email, "Demo1234!")).rejects.toThrow(UnauthorizedError);
  });

  // Cubre: RNF-AUT-04
  it("el 6.º intento seguido con la misma contraseña incorrecta lanza RateLimitError", async () => {
    const email = `rate-limit-${Date.now()}@test.formia.local`;
    await createActiveUser(email, "Demo1234!");

    for (let i = 0; i < 5; i++) {
      await expect(verifyPassword(email, "incorrecta")).rejects.toThrow(UnauthorizedError);
    }

    await expect(verifyPassword(email, "incorrecta")).rejects.toThrow(RateLimitError);
  });

  // Cubre: RF-AUT-02, CA-AUT-05
  it("requestMagicLink con email existente crea un LoginToken y llama a sendEmail", async () => {
    const email = `magic-${Date.now()}@test.formia.local`;
    await createActiveUser(email, "Demo1234!");

    await requestMagicLink(email);

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: email }));

    const user = await prisma.user.findUnique({ where: { email } });
    const tokens = await prisma.loginToken.findMany({ where: { userId: user?.id } });
    expect(tokens).toHaveLength(1);
  });

  // Cubre: RF-AUT-02, CA-AUT-05, RNF-AUT-02
  it("requestMagicLink con email inexistente no lanza y no envía nada", async () => {
    vi.clearAllMocks();

    await expect(requestMagicLink(`inexistente-${Date.now()}@test.formia.local`)).resolves.toBeUndefined();

    expect(sendEmail).not.toHaveBeenCalled();
  });

  // Cubre: RF-AUT-02, CA-AUT-05
  it("verifyMagicLink con un token válido devuelve CurrentUser y lo invalida", async () => {
    const email = `magic-verify-${Date.now()}@test.formia.local`;
    const user = await createActiveUser(email, "Demo1234!");
    const token = `token-${Date.now()}`;
    await createLoginToken(user.id, token, new Date(Date.now() + 15 * 60 * 1000));

    const current = await verifyMagicLink(token);
    expect(current.email).toBe(email);

    await expect(verifyMagicLink(token)).rejects.toThrow(UnauthorizedError);
  });

  // Cubre: RF-AUT-02, CA-AUT-05
  it("verifyMagicLink con un token caducado lanza UnauthorizedError", async () => {
    const email = `magic-expired-${Date.now()}@test.formia.local`;
    const user = await createActiveUser(email, "Demo1234!");
    const token = `expired-${Date.now()}`;
    await createLoginToken(user.id, token, new Date(Date.now() - 1000));

    await expect(verifyMagicLink(token)).rejects.toThrow(UnauthorizedError);
  });
});
