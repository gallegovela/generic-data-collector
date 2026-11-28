import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Demo1234!";

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(admin|collect)/);
}

// Cubre: CA-SET-01, RF-SET-01
test("un collector no entra en los ajustes: va a /collect", async ({ page }) => {
  await login(page, "collector@demo.formia.local");
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/collect$/);
  await page.goto("/admin/settings/plans");
  await expect(page).toHaveURL(/\/collect$/);
});

// Cubre: CA-SET-01, RF-SET-01
test("un anónimo va a /login", async ({ page }) => {
  await page.goto("/admin/settings/plans");
  await expect(page).toHaveURL(/\/login/);
});

// Cubre: RF-SET-02
test("el admin ve Ajustes, el enlace Planes y llega a /admin/settings/plans", async ({ page }) => {
  await login(page, "admin@demo.formia.local");
  await expect(page.getByRole("link", { name: "Ajustes" })).toBeVisible();
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/admin\/settings\/plans$/);
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Planes" })).toBeVisible();
});
