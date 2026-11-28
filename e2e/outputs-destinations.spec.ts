import { expect, test, type Page } from "@playwright/test";
import { createOrganization } from "@/server/auth/organization.repository";
import { hashPassword } from "@/server/auth/auth.service";
import { createUser } from "@/server/auth/user.repository";
import { prisma } from "@/server/db/client";
import { createFormFixture, deleteOutputsData } from "../prisma/fixtures/outputs.fixtures";
import { login } from "./helpers/form-editor";
import { addSubmission, demoOrganizationId } from "./helpers/submissions-dashboard";

// Cubre: CA-OUT-09, CA-OUT-10, CA-OUT-12, RF-OUT-01
// No usa red externa: https://example.com/hook solo pasa la validación de URL (sin DNS).

const FOREIGN_EMAIL = `admin-b-${Date.now()}@otra-org.test`;
const FOREIGN_PASSWORD = "Otra1234!";

let demoOrgId = "";
let formId = "";
let submissionId = "";
let foreignOrgId = "";

test.beforeAll(async () => {
  demoOrgId = await demoOrganizationId();
  formId = (await createFormFixture(demoOrgId, `Destinos e2e ${Date.now()}`)).id;
  submissionId = (await addSubmission(demoOrgId, formId, 1)).id;
  const foreign = await createOrganization({ name: `Org B (outputs-destinations ${formId})` });
  foreignOrgId = foreign.id;
  await createUser(foreign.id, {
    email: FOREIGN_EMAIL,
    name: "Admin B",
    role: "admin",
    passwordHash: await hashPassword(FOREIGN_PASSWORD),
  });
});

test.afterAll(async () => {
  await prisma.destination.deleteMany({ where: { formId } });
  await prisma.submission.deleteMany({ where: { formId } });
  await prisma.form.deleteMany({ where: { id: formId } });
  await prisma.user.deleteMany({ where: { organizationId: foreignOrgId } });
  await deleteOutputsData([foreignOrgId]);
});

async function loginForeign(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(FOREIGN_EMAIL);
  await page.getByLabel("Contraseña").fill(FOREIGN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/admin/);
}

test("CA-OUT-10: una URL privada se rechaza y una pública muestra el secreto una sola vez", async ({ page }) => {
  await login(page);
  await page.goto(`/admin/forms/${formId}/destinations`);

  await page.getByLabel("URL (http o https)").fill("http://10.0.0.5/hook");
  await page.getByRole("button", { name: "Guardar webhook" }).click();
  await expect(page.getByTestId("webhook-message")).toHaveText(
    "La URL apunta a una dirección privada o no permitida.",
  );
  expect(await prisma.destination.count({ where: { formId, kind: "webhook" } })).toBe(0);

  await page.getByLabel("URL (http o https)").fill("https://example.com/hook");
  await page.getByRole("button", { name: "Guardar webhook" }).click();
  await expect(page.getByTestId("webhook-secret")).toContainText("whsec_");
  expect(await prisma.destination.count({ where: { formId, kind: "webhook" } })).toBe(1);

  await page.reload();
  await expect(page.getByTestId("webhook-secret")).toHaveCount(0);
  await expect(page.getByLabel("URL (http o https)")).toHaveValue("https://example.com/hook");
});

test("RF-OUT-01: el email con dos direcciones se conserva al recargar", async ({ page }) => {
  await login(page);
  await page.goto(`/admin/forms/${formId}/destinations`);
  await page.getByLabel(/Destinatarios/).fill("uno@empresa.test, dos@empresa.test");
  await page.getByRole("button", { name: "Guardar email" }).click();
  await expect(page.getByTestId("email-message")).toHaveText("Guardado.");
  await page.reload();
  await expect(page.getByLabel(/Destinatarios/)).toHaveValue("uno@empresa.test, dos@empresa.test");
  await expect(page.getByTestId("gdpr-notice")).toContainText("datos personales");
});

test("CA-OUT-09: otra organización recibe 404 en la pantalla de destinos", async ({ page }) => {
  await loginForeign(page);
  const response = await page.goto(`/admin/forms/${formId}/destinations`);
  expect(response?.status()).toBe(404);
});

test("CA-OUT-12: «Descargar PDF» devuelve un PDF a la organización y 404 a otra", async ({ page, browser }) => {
  await login(page);
  await page.goto(`/admin/forms/${formId}/submissions/${submissionId}`);
  const href = await page.getByTestId("pdf-download").getAttribute("href");
  expect(href).toBe(`/api/forms/${formId}/submissions/${submissionId}/pdf`);
  const response = await page.request.get(href ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");

  const context = await browser.newContext();
  const other = await context.newPage();
  await loginForeign(other);
  expect((await other.request.get(href ?? "")).status()).toBe(404);
  await context.close();
});
