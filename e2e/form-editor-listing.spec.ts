import { expect, test } from "@playwright/test";
import { login, seedForm, textField, uniqueName } from "./helpers/form-editor";
import { publishViaService } from "./helpers/form-publishing";
import { addSubmission, deleteSubmissionsOfForms, demoOrganizationId } from "./helpers/submissions-dashboard";

// Cubre: CA-EDT-04, CA-EDT-05, CA-EDT-06
test("crear, duplicar y archivar desde el listado", async ({ page }) => {
  const name = uniqueName("Parte");
  await login(page);
  await page.goto("/admin/forms");

  // Crear (CA-EDT-04)
  await page.getByRole("button", { name: "Nuevo formulario" }).click();
  await page.getByLabel("Nombre").fill(name);
  await page.getByRole("button", { name: "Crear" }).click();
  await page.goto("/admin/forms");
  const row = page.locator(`[data-testid="form-row"][data-form-name="${name}"]`);
  await expect(row).toContainText("Borrador");
  await expect(row).toContainText("Sin publicar");
  await expect(row).toContainText("0");

  // Duplicar (CA-EDT-05)
  const copyName = `${name} copia`;
  await row.getByRole("button", { name: `Acciones de «${name}»` }).click();
  await page.getByRole("menuitem", { name: "Duplicar" }).click();
  await page.getByLabel("Nombre").fill(copyName);
  await page.getByRole("button", { name: "Duplicar", exact: true }).click();
  await expect(page.locator(`[data-testid="form-row"][data-form-name="${copyName}"]`)).toBeVisible();
  await expect(row).toBeVisible();

  // Archivar (CA-EDT-06)
  await row.getByRole("button", { name: `Acciones de «${name}»` }).click();
  await page.getByRole("menuitem", { name: "Archivar" }).click();
  await page.getByRole("button", { name: "Archivar", exact: true }).click();
  await expect(row).toHaveCount(0);
  await expect(page.locator(`[data-testid="form-row"][data-form-name="${copyName}"]`)).toBeVisible();
});

// Cubre: CA-EDT-13, CA-EDT-15
test("CA-EDT-13 CA-EDT-15: Rellenar lleva a /f/<slug> y el contador es real", async ({ page }) => {
  const name = uniqueName("Rellenar");
  const id = await seedForm(name, { title: name, fields: [textField("a", "Campo A")] });
  const { slug } = await publishViaService(id, "public");
  const orgId = await demoOrganizationId();
  try {
    for (const n of [1, 2, 3]) await addSubmission(orgId, id, n);
    await login(page);
    await page.goto("/admin/forms");
    const row = page.locator(`[data-testid="form-row"][data-form-name="${name}"]`);

    // CA-EDT-15
    await expect(row.getByTestId("response-count")).toHaveText("3");
    await expect(row.getByTestId("response-count").getByRole("link")).toHaveAttribute(
      "href",
      `/admin/forms/${id}/submissions`,
    );

    // CA-EDT-13
    await row.getByRole("button", { name: `Acciones de «${name}»` }).click();
    await expect(page.getByRole("menuitem", { name: "Rellenar" })).toHaveAttribute("href", `/f/${slug}`);
    await page.getByRole("menuitem", { name: "Rellenar" }).click();
    await page.waitForURL(new RegExp(`/f/${slug}$`));
  } finally {
    await deleteSubmissionsOfForms([id]);
  }
});

// Cubre: CA-EDT-14
test("CA-EDT-14: en borrador Rellenar no está disponible y se explica por qué", async ({ page }) => {
  const name = uniqueName("Borrador");
  await seedForm(name, { title: name, fields: [] });
  await login(page);
  await page.goto("/admin/forms");
  const row = page.locator(`[data-testid="form-row"][data-form-name="${name}"]`);
  await row.getByRole("button", { name: `Acciones de «${name}»` }).click();
  await expect(page.getByRole("menuitem", { name: /Rellenar/ })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Publica el formulario para poder rellenarlo")).toBeVisible();
});
