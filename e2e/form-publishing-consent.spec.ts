import { expect, test } from "@playwright/test";
import { login, publishViaService, seedForm, textField, uniqueName } from "./helpers/form-publishing";

const FIELDS = [textField("a", "Campo A")];

test.describe("CA-PUB-08 términos obligatorios al publicar en público", () => {
  // Cubre: CA-PUB-08
  test("el panel exige los tres datos y muestra el error del servidor", async ({ page }) => {
    const id = await seedForm(uniqueName("Consent"), { title: "Consent", fields: FIELDS });
    await login(page);
    await page.goto(`/admin/forms/${id}`);

    await expect(page.getByTestId("consent-fields")).toHaveCount(0);
    await page.getByTestId("access-mode").selectOption("public");
    await expect(page.getByTestId("consent-fields")).toBeVisible();

    // Sin declaración no se puede publicar.
    await page.getByTestId("terms-url").fill("https://example.com/terminos");
    await page.getByTestId("privacy-url").fill("https://example.com/privacidad");
    await expect(page.getByTestId("publish-button")).toBeDisabled();

    // Un enlace http lo rechaza el servidor.
    await page.getByTestId("terms-url").fill("http://example.com/terminos");
    await page.getByTestId("publisher-declaration").check();
    await page.getByTestId("publish-button").click();
    await expect(page.getByTestId("consent-error-termsUrl")).toContainText("https://");

    await page.getByTestId("terms-url").fill("https://example.com/terminos");
    await page.getByTestId("publish-button").click();
    await expect(page.getByTestId("form-link")).toHaveValue(/\/f\/[a-z0-9]{10}$/);
  });
});

test.describe("CA-PUB-11 lectura pública con términos", () => {
  // Cubre: CA-PUB-11
  test("la API pública devuelve consent y organizationName sin declaredBy", async ({ request }) => {
    const id = await seedForm(uniqueName("ConsentApi"), { title: "ConsentApi", fields: FIELDS });
    const { slug } = await publishViaService(id, "public");
    const response = await request.get(`/api/public/forms/${slug}`);
    expect(response.status()).toBe(200);
    const text = await response.text();
    const body = JSON.parse(text) as {
      consent: { termsUrl: string; privacyUrl: string } | null;
      organizationName: string;
    };
    expect(body.consent?.termsUrl).toBe("https://example.com/terminos");
    expect(body.consent?.privacyUrl).toBe("https://example.com/privacidad");
    expect(body.organizationName.length).toBeGreaterThan(0);
    expect(text).not.toContain("declaredBy");
  });
});

test.describe("CA-PUB-10 cambio a público en un formulario publicado", () => {
  // Cubre: CA-PUB-10
  test("sin términos en la versión muestra el aviso y no cambia el modo", async ({ page, request }) => {
    const id = await seedForm(uniqueName("ConsentSwitch"), { title: "ConsentSwitch", fields: FIELDS });
    const { slug } = await publishViaService(id, "registered");
    await login(page);
    await page.goto(`/admin/forms/${id}`);

    await page.getByTestId("access-mode").selectOption("public");
    await expect(page.getByTestId("consent-notice")).toContainText(
      "Para hacerlo público, publica de nuevo con los términos y condiciones",
    );

    // El servidor sigue en registered: sin sesión la API pide login.
    const anonymous = await request.get(`/api/public/forms/${slug}`);
    expect(anonymous.status()).toBe(401);
  });
});
