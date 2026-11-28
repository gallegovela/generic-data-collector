import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Demo1234!";

async function loginAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@demo.formia.local");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/admin/);
}

// Cubre: RF-SET-03, RF-SET-04, RF-SET-05, RF-SET-06
test("el admin crea, edita, asigna y borra un plan", async ({ page }) => {
  const name = `Plan e2e ${Date.now()}`;
  const renamed = `${name} editado`;
  await loginAdmin(page);
  await page.goto("/admin/settings/plans");

  const generic = page.getByTestId("plan-row-Genérico");
  await expect(generic).toContainText("Plan actual");

  // Crear con límites vacíos.
  await page.getByLabel("Nombre").fill(name);
  await page.getByRole("button", { name: "Crear plan" }).click();
  const row = page.getByTestId(`plan-row-${name}`);
  await expect(row).toContainText("Sin límite");

  // Editar.
  await row.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Nombre").fill(renamed);
  await page.getByLabel("Respuestas por hora").fill("50");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  const edited = page.getByTestId(`plan-row-${renamed}`);
  await expect(edited).toContainText("50");

  // Asignar: el borrado queda deshabilitado.
  await edited.getByRole("button", { name: "Usar este plan" }).click();
  await expect(edited).toContainText("Plan actual");
  await expect(edited.getByRole("button", { name: "Borrar" })).toBeDisabled();

  // Volver a Genérico y borrar.
  await generic.getByRole("button", { name: "Usar este plan" }).click();
  await expect(generic).toContainText("Plan actual");
  page.once("dialog", (dialog) => void dialog.accept());
  await edited.getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByTestId(`plan-row-${renamed}`)).toHaveCount(0);
});
