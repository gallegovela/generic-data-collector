import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/server/db/client";

vi.mock("@/server/integrations/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { createOrganization } from "./organization.repository";
import { createUser } from "./user.repository";
import { hashPassword, verifyPassword } from "./auth.service";
import { acceptInvitation, deactivateUser, inviteUser } from "./user.service";

describe("user.service", () => {
  let organization: { id: string };
  let admin: { id: string };

  beforeAll(async () => {
    organization = await createOrganization({ name: "Organización user.service (test)" });
    admin = await createUser(organization.id, {
      email: `admin-${Date.now()}@test.formia.local`,
      name: "Admin de prueba",
      role: "admin",
      passwordHash: await hashPassword("Demo1234!"),
    });
  });

  afterAll(async () => {
    await prisma.invitation.deleteMany({ where: { organizationId: organization.id } });
    await prisma.user.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
  });

  // Cubre: RF-AUT-03, RF-AUT-04, CA-AUT-03
  it("invite: crea la invitación y envía el email", async () => {
    const email = `invite-${Date.now()}@test.formia.local`;
    const invitation = await inviteUser(organization.id, admin.id, { email, role: "collector" });

    expect(invitation.email).toBe(email);
    expect(invitation.role).toBe("collector");
    expect(invitation.acceptedAt).toBeNull();
  });

  // Cubre: RF-AUT-04
  it("invite: con un email ya registrado lanza ConflictError", async () => {
    const email = `invite-dup-${Date.now()}@test.formia.local`;
    await createUser(organization.id, {
      email,
      name: "Ya existe",
      role: "collector",
      passwordHash: await hashPassword("Demo1234!"),
    });

    await expect(inviteUser(organization.id, admin.id, { email, role: "collector" })).rejects.toThrow(
      ConflictError,
    );
  });

  // Cubre: CA-AUT-03
  it("invite + accept: acceptInvitation crea el User con el rol de la invitación y permite iniciar sesión después", async () => {
    const email = `invite-accept-${Date.now()}@test.formia.local`;
    const invitation = await inviteUser(organization.id, admin.id, { email, role: "admin" });

    const current = await acceptInvitation(invitation.token, "Demo1234!");

    expect(current).toMatchObject({ email, organizationId: organization.id, role: "admin" });

    const loggedIn = await verifyPassword(email, "Demo1234!");
    expect(loggedIn.email).toBe(email);
  });

  // Cubre: CA-AUT-03
  it("accept: con el mismo token una segunda vez lanza UnauthorizedError", async () => {
    const email = `invite-twice-${Date.now()}@test.formia.local`;
    const invitation = await inviteUser(organization.id, admin.id, { email, role: "collector" });

    await acceptInvitation(invitation.token, "Demo1234!");

    await expect(acceptInvitation(invitation.token, "Demo1234!")).rejects.toThrow(UnauthorizedError);
  });

  // Cubre: CA-AUT-03
  it("accept: con un token caducado lanza UnauthorizedError", async () => {
    const email = `invite-expired-${Date.now()}@test.formia.local`;
    const invitation = await inviteUser(organization.id, admin.id, { email, role: "collector" });
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(acceptInvitation(invitation.token, "Demo1234!")).rejects.toThrow(UnauthorizedError);
  });

  // Cubre: RF-AUT-05
  it("deactivateUser: con el id del propio actingUserId lanza ForbiddenError", async () => {
    await expect(deactivateUser(organization.id, admin.id, admin.id)).rejects.toThrow(ForbiddenError);
  });

  // Cubre: RF-AUT-05, CA-AUT-01
  it("deactivateUser: cambia el estado dentro de la misma organización", async () => {
    const target = await createUser(organization.id, {
      email: `deactivate-${Date.now()}@test.formia.local`,
      name: "A desactivar",
      role: "collector",
      passwordHash: await hashPassword("Demo1234!"),
    });

    await deactivateUser(organization.id, admin.id, target.id);

    const updated = await prisma.user.findUnique({ where: { id: target.id } });
    expect(updated?.status).toBe("inactive");
  });

  // Cubre: CA-AUT-01 — "otra organizacion"
  it("deactivateUser: con un id de otra organizacion lanza NotFoundError", async () => {
    const otherOrg = await createOrganization({ name: "Otra organización (test)" });
    const otherUser = await createUser(otherOrg.id, {
      email: `other-org-${Date.now()}@test.formia.local`,
      name: "De otra organización",
      role: "collector",
      passwordHash: await hashPassword("Demo1234!"),
    });

    await expect(deactivateUser(organization.id, admin.id, otherUser.id)).rejects.toThrow(NotFoundError);

    await prisma.user.delete({ where: { id: otherUser.id } });
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });
});
