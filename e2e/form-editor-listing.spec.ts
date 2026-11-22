import { expect, test } from "@playwright/test";
import { login, uniqueName } from "./helpers/form-editor";

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
