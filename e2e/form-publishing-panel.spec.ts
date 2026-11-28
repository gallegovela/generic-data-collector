import { expect, test } from "@playwright/test";
import { login, seedForm, textField, uniqueName } from "./helpers/form-publishing";

const FIELDS = [textField("a", "Campo A")];

// Cubre: CA-PUB-01, CA-PUB-02
test("CA-PUB-01 CA-PUB-02: el admin publica, ve enlace y QR y abre /f/<slug>", async ({ page }) => {
  const id = await seedForm(uniqueName("Publicar"), { title: "Publicar", fields: FIELDS });
  await login(page);
  await page.goto(`/admin/forms/${id}`);

  await page.getByTestId("access-mode").selectOption("public");
  await page.getByTestId("publish-button").click();

  const link = page.getByTestId("form-link");
  await expect(link).toHaveValue(/\/f\/[a-z0-9]{10}$/);
  await expect(page.getByTestId("publish-status")).toHaveText("Publicado v1");

  const qr = page.getByTestId("form-qr");
  await expect(qr).toBeVisible();
  await expect
    .poll(() => qr.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  const png = await page.request.get(`/api/forms/${id}/qr?format=png`);
  expect(png.headers()["content-type"]).toContain("image/png");
  const svg = await page.request.get(`/api/forms/${id}/qr?format=svg`);
  expect(svg.headers()["content-type"]).toContain("image/svg+xml");

  const slug = (await link.inputValue()).split("/f/")[1];
  await page.goto(`/f/${slug}`);
  await expect(page.getByTestId("fill-form")).toBeVisible();
});

// Cubre: CA-PUB-06
test("CA-PUB-06: despublicar cierra el enlace y republicar lo reabre", async ({ page }) => {
  const id = await seedForm(uniqueName("Despublicar"), { title: "Despublicar", fields: FIELDS });
  await login(page);
  await page.goto(`/admin/forms/${id}`);
  await page.getByTestId("publish-button").click();
  await expect(page.getByTestId("publish-status")).toHaveText("Publicado v1");
  const slug = (await page.getByTestId("form-link").inputValue()).split("/f/")[1];

  await page.getByTestId("unpublish-button").click();
  await page.getByTestId("unpublish-confirm").click();
  await expect(page.getByTestId("publish-status")).toHaveText("Despublicado");

  await page.goto(`/f/${slug}`);
  await expect(page.getByText("Este formulario ya no acepta respuestas")).toBeVisible();

  await page.goto(`/admin/forms/${id}`);
  await page.getByTestId("publish-button").click();
  await expect(page.getByTestId("publish-status")).toHaveText("Publicado v2");
  await page.goto(`/f/${slug}`);
  await expect(page.getByTestId("fill-form")).toBeVisible();
});

// Cubre: CA-PUB-07
test("CA-PUB-07: un borrador sin campos no se publica y no hay enlace", async ({ page }) => {
  const id = await seedForm(uniqueName("Vacio"), { title: "Vacío", fields: [] });
  await login(page);
  await page.goto(`/admin/forms/${id}`);
  await page.getByTestId("publish-button").click();

  await expect(page.getByTestId("publish-error")).toContainText(
    "El formulario necesita al menos un campo para publicarse.",
  );
  await expect(page.getByTestId("form-link")).toHaveCount(0);
});

// Cubre: RF-PUB-01
test("RF-PUB-01: si el autoguardado falla, Publicar queda bloqueado", async ({ page }) => {
  const id = await seedForm(uniqueName("Fallo"), { title: "Fallo", fields: FIELDS });
  await login(page);
  await page.goto(`/admin/forms/${id}`);

  await page.route(`**/admin/forms/${id}`, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, body: "error" })
      : route.continue(),
  );
  await page.getByLabel("Título del formulario").fill("Título cambiado");

  await expect(page.getByTestId("publish-blocked")).toHaveText(
    "No se pudo guardar el borrador; reinténtalo antes de publicar",
    { timeout: 10_000 },
  );
  await expect(page.getByTestId("publish-button")).toBeDisabled();
});
