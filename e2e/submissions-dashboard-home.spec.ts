import { expect, test } from "@playwright/test";
import { login } from "./helpers/form-editor";
import { addSubmission, deleteSubmissionsOfForms, demoOrganizationId, uniqueFormId } from "./helpers/submissions-dashboard";

const formId = uniqueFormId("home");
const title = `Parte home ${formId}`;

test.beforeAll(async () => {
  const org = await demoOrganizationId();
  for (let i = 0; i < 3; i++) await addSubmission(org, formId, i, { title });
});
test.afterAll(async () => deleteSubmissionsOfForms([formId]));

// Cubre: CA-SUB-06
test("el panel de inicio muestra contadores y el desglose por formulario", async ({ page }) => {
  await login(page);
  await page.goto("/admin");
  const today = Number(await page.getByTestId("stat-today").innerText());
  const week = Number(await page.getByTestId("stat-week").innerText());
  expect(today).toBeGreaterThanOrEqual(3);
  expect(week).toBeGreaterThanOrEqual(today);
  await expect(page.getByTestId("stat-form").filter({ hasText: title })).toContainText("3");
});
