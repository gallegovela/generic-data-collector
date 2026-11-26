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

const versionFormId = uniqueFormId("version");

test.describe("versiones", () => {
  test.beforeAll(async () => {
    const org = await demoOrganizationId();
    await addSubmission(org, versionFormId, 0, { formVersionNumber: 1 });
    await addSubmission(org, versionFormId, 1, { formVersionNumber: 2 });
    await addSubmission(org, versionFormId, 2, { formVersionNumber: 2 });
    await addSubmission(org, versionFormId, 3); // anterior a #27: sin versión
  });
  test.afterAll(async () => deleteSubmissionsOfForms([versionFormId]));

  // Cubre: CA-SUB-14, RF-SUB-12
  test("CA-SUB-14: el listado muestra la versión y se filtra por ella", async ({ page }) => {
    await login(page);
    await page.goto(`/admin/forms/${versionFormId}/submissions`);
    await expect(page.getByTestId("submission-row")).toHaveCount(4);
    await expect(page.getByTestId("submission-version").filter({ hasText: "—" })).toHaveCount(1);

    await page.goto(`/admin/forms/${versionFormId}/submissions?version=2`);
    await expect(page.getByTestId("submission-row")).toHaveCount(2);
    await expect(page.getByTestId("submission-version").filter({ hasText: "v2" })).toHaveCount(2);

    await page.goto(`/admin/forms/${versionFormId}/submissions`);
    await page.getByLabel("Versión").selectOption({ label: "v1" });
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByTestId("submission-row")).toHaveCount(1);
  });
});
