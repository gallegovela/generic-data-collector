import { expect, test } from "@playwright/test";
import { prisma } from "@/server/db/client";
import { inviteUser } from "@/server/auth/user.service";

let invitedEmail: string;
let invitationToken: string;

test.beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@demo.formia.local" } });
  invitedEmail = `e2e-invite-${Date.now()}@test.formia.local`;

  // Se crea la invitación llamando directamente al servicio, sin
  // pasar por el email (ver specs/tenancy-auth/design.md#tests).
  const invitation = await inviteUser(admin.organizationId, admin.id, {
    email: invitedEmail,
    role: "collector",
  });
  invitationToken = invitation.token;
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: invitedEmail } });
});

// Cubre: RF-AUT-03, CA-AUT-03
test("aceptar una invitación desde la interfaz abre sesión con el rol de la invitación", async ({
  page,
  context,
}) => {
  await page.goto(`/invite/${invitationToken}`);
  await page.getByLabel("Crea tu contraseña").fill("Demo1234!");
  await page.getByRole("button", { name: "Aceptar invitación" }).click();

  // La invitación es de rol collector: tras iniciar sesión termina en
  // /collect (el middleware redirige desde /admin, ver RF-AUT-06).
  await page.waitForURL(/\/collect$/);

  const cookies = await context.cookies();
  expect(cookies.some((cookie) => cookie.name.includes("session-token"))).toBe(true);
});
