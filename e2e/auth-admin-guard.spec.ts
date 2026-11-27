import { expect, test, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@demo.formia.local";
const COLLECTOR_EMAIL = "collector@demo.formia.local";
const PASSWORD = "Demo1234!";

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(admin|forms)/);
}

// Cubre: RF-AUT-06, CA-AUT-02
test("un collector no entra en /admin: se le redirige a /forms", async ({ page }) => {
  await login(page, COLLECTOR_EMAIL);

  await page.goto("/admin");

  await expect(page).toHaveURL(/\/forms$/);
});

// Cubre: RF-AUT-06, CA-AUT-02
test("un admin sí entra en /admin", async ({ page }) => {
  await login(page, ADMIN_EMAIL);

  const response = await page.goto("/admin");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/admin$/);
});
