import { expect, test } from "@playwright/test";

// Credenciales del admin del seed (ver
// specs/tenancy-auth/design.md#datos-de-ejemplo-seed).
const ADMIN_EMAIL = "admin@demo.formia.local";
const ADMIN_PASSWORD = "Demo1234!";

// Cubre: RF-AUT-01, CA-AUT-04, RNF-AUT-03
test("login con contraseña correcta entra en /admin con una cookie de sesión HttpOnly y SameSite=Lax", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  await page.waitForURL("**/admin");

  const cookies = await context.cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name.includes("session-token"));

  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe("Lax");
});

// Cubre: CA-AUT-04
test("login con contraseña incorrecta se queda en /login mostrando un error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

// Cubre: CA-AUT-09
test("un email inexistente muestra el mismo mensaje que una contraseña incorrecta", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(`nadie-${Date.now()}@demo.formia.local`);
  await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByText("Email o contraseña incorrectos.", { exact: true })).toBeVisible();
});
