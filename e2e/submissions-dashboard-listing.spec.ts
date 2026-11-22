import { expect, test } from "@playwright/test";
import { login } from "./helpers/form-editor";
import { addSubmission, deleteSubmissionsOfForms, demoOrganizationId, uniqueFormId } from "./helpers/submissions-dashboard";

const formId = uniqueFormId("listing");

test.beforeAll(async () => {
  const org = await demoOrganizationId();
  for (let i = 0; i < 21; i++) {
    await addSubmission(org, formId, i, { answers: { site: `Obra ${i}`, has_incidents: i === 3 } });
  }
});
test.afterAll(async () => deleteSubmissionsOfForms([formId]));

// Cubre: CA-SUB-04, CA-SUB-02
test("listado: paginación, filtro sí/no y apertura de ficha", async ({ page }) => {
  await login(page);
  await page.goto(`/admin/forms/${formId}/submissions`);

  await expect(page.getByTestId("submission-row")).toHaveCount(20);
  await expect(page.getByTestId("submissions-total")).toContainText("21 respuestas");

  await page.getByRole("link", { name: "Siguiente" }).click();
  await expect(page.getByTestId("submission-row")).toHaveCount(1);

  await page.goto(`/admin/forms/${formId}/submissions`);
  await page.getByLabel("Campo").selectOption({ label: "¿Hay incidencias?" });
  await page.getByLabel("Valor").selectOption({ label: "Sí" });
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByTestId("submission-row")).toHaveCount(1);

  await page.getByRole("link", { name: "Ver" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/forms/${formId}/submissions/[^/]+$`));
  await expect(page.getByText("Obra 3")).toBeVisible();
});
