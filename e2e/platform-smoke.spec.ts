import { expect, test } from "@playwright/test";

// Cubre: CA-PLT-01
test("la aplicación responde en la página de inicio", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "FormIA" })).toBeVisible();
});
