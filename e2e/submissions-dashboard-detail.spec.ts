import { expect, test } from "@playwright/test";
import { login } from "./helpers/form-editor";
import { addSubmission, deleteSubmissionsOfForms, demoOrganizationId, uniqueFormId } from "./helpers/submissions-dashboard";

const formId = uniqueFormId("detail");
let submissionId: string;

test.beforeAll(async () => {
  const org = await demoOrganizationId();
  const s = await addSubmission(org, formId, 1, {
    answers: {
      site: "Obra Norte",
      has_incidents: true,
      photos: [{ key: "a.jpg" }, { key: "b.jpg" }],
      location: { lat: 40.4168, lng: -3.7038, accuracy: 10, capturedAt: "2026-11-01T10:00:00.000Z" },
      foreman_signature: { key: "sig.png" },
    },
  });
  submissionId = s.id;
});
test.afterAll(async () => deleteSubmissionsOfForms([formId]));

test.beforeEach(async ({ page }) => {
  await login(page);
  await page.goto(`/admin/forms/${formId}/submissions/${submissionId}`);
});

// Cubre: CA-SUB-03
test("CA-SUB-03: la ficha muestra el mapa con un marcador", async ({ page }) => {
  const map = page.getByTestId("submission-map");
  await expect(map).toBeVisible();
  await expect(map.locator(".leaflet-interactive")).toHaveCount(1);
});

// Cubre: CA-SUB-09
test("CA-SUB-09: miniaturas de fotos y firma, ampliables", async ({ page, context }) => {
  await expect(page.getByTestId("photo-thumbnail")).toHaveCount(2);
  await expect(page.getByTestId("signature-image")).toHaveCount(1);
  const popup = context.waitForEvent("page");
  await page.getByTestId("photo-thumbnail").first().click();
  expect((await popup).url()).toContain("placeholder-photo.svg");
});

// Cubre: CA-SUB-07
test("CA-SUB-07: la ficha es de solo lectura", async ({ page }) => {
  await expect(page.getByText("Obra Norte")).toBeVisible();
  await expect(page.locator("main input, main textarea, main select")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /guardar|editar/i })).toHaveCount(0);
});
