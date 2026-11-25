import { expect, test } from "@playwright/test";

// Cubre: CA-AUT-08. Usa un email inventado y único para no bloquear las
// cuentas del seed; el limitador vive en la memoria del servidor.
test("tras 5 fallos el 6.º intento muestra el mensaje de límite", async ({ page }) => {
  const email = `bloqueo-${Date.now()}-${Math.random().toString(36).slice(2)}@demo.formia.local`;

  await page.goto("/login");

  for (let attempt = 1; attempt <= 5; attempt++) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(`incorrecta-${attempt}`);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Email o contraseña incorrectos.", { exact: true })).toBeVisible();
  }

  await page.getByLabel("Contraseña").fill("incorrecta-6");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByText("Demasiados intentos, prueba de nuevo más tarde.")).toBeVisible();
});
