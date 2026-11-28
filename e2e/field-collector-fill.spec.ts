import { expect, test, type Page } from "@playwright/test";
import type { DraftForm } from "@/lib/form-editor/form-editor.schema";
import { prisma } from "@/server/db/client";
import { photoFile } from "./fixtures/images";
import {
  drawSignature,
  login,
  publishTestForm,
  stubGeolocation,
  submissionsOf,
} from "./helpers/field-collector";

const text = (id: string, label: string, required = false) => ({
  id,
  type: "text" as const,
  label,
  required,
  config: {},
});

async function openFill(page: Page, slug: string): Promise<void> {
  await login(page);
  await page.goto(`/f/${slug}`);
  await expect(page.getByTestId("fill-form")).toBeVisible();
}

const CONDITIONAL: DraftForm = {
  title: "Parte condicional",
  fields: [
    { id: "incident", type: "yes_no", label: "¿Hay incidencias?", required: true, config: {} },
    {
      id: "detail",
      type: "text",
      label: "Detalle de la incidencia",
      required: true,
      visibleIf: { fieldId: "incident", operator: "equals", value: true },
      config: {},
    },
  ],
};

test.describe("con ubicación permitida", () => {
  test.beforeEach(async ({ page }) => {
    await stubGeolocation(page);
  });

  // Cubre: CA-COL-03, RF-COL-02
  test("CA-COL-03: el campo condicional aparece y desaparece y no se exige oculto", async ({ page }) => {
    const form = await publishTestForm(CONDITIONAL, "registered");
    await openFill(page, form.slug);

    await expect(page.getByTestId("field-wrapper-detail")).toHaveCount(0);
    await page.locator("#field-incident").getByText("Sí", { exact: true }).click();
    await expect(page.getByTestId("field-wrapper-detail")).toBeVisible();
    await page.locator("#field-incident").getByText("No", { exact: true }).click();
    await expect(page.getByTestId("field-wrapper-detail")).toHaveCount(0);

    await page.getByTestId("save").click();
    await expect(page.getByTestId("save-success")).toBeVisible();

    const [submission] = await submissionsOf(form.id);
    expect(submission.answers).toEqual({ incident: false });
  });

  // Cubre: CA-COL-04, RF-COL-09, RF-COL-10, RF-COL-11, RF-COL-13, RF-COL-18, RF-COL-20
  test("CA-COL-04: rellena con foto, firma y GPS, guarda y la ficha muestra las imágenes", async ({
    page,
  }) => {
    const form = await publishTestForm(
      {
        title: "Parte con archivos",
        fields: [
          text("note", "Nota", true),
          { id: "photos", type: "photo", label: "Fotos", required: true, config: { maxPhotos: 3, allowGallery: true } },
          { id: "sign", type: "signature", label: "Firma", required: true, config: {} },
          { id: "where", type: "gps", label: "Ubicación", required: true, config: {} },
        ],
      },
      "registered",
    );
    await openFill(page, form.slug);

    await page.getByTestId("field-note").fill("Todo bien");
    await page.getByTestId("photo-input-photos").setInputFiles(photoFile());
    await expect(page.getByAltText("Foto añadida")).toBeVisible();
    await drawSignature(page, "sign");
    await page.getByRole("button", { name: "Obtener ubicación" }).click();
    await expect(page.getByTestId("gps-value-where")).toBeVisible();

    await page.getByTestId("save").click();
    await expect(page.getByTestId("save-success")).toBeVisible();
    await page.waitForURL(/\/admin\/forms$/);

    const [submission] = await submissionsOf(form.id);
    expect(submission.formVersionNumber).toBe(1);
    expect(submission.capturedAt).toBeTruthy();
    const answers = submission.answers as Record<string, unknown>;
    const photoKey = (answers.photos as Array<{ key: string }>)[0].key;
    const signKey = (answers.sign as { key: string }).key;
    expect(JSON.stringify(answers)).not.toMatch(/https?:/);
    const stored = await prisma.storedFile.findMany({ where: { key: { in: [photoKey, signKey] } } });
    expect(stored).toHaveLength(2);
    expect(stored.every((f) => f.submissionId === submission.id)).toBe(true);

    // La lectura se hace con URL firmada de vida corta (/api/files → 302).
    const redirect = await page.request.get(`/api/files?key=${encodeURIComponent(photoKey)}`, {
      maxRedirects: 0,
    });
    expect(redirect.status()).toBe(302);
    expect(redirect.headers().location).toMatch(/X-Amz-Signature=/);

    await page.goto(`/admin/forms/${form.id}/submissions/${submission.id}`);
    const images = page.locator("dl img");
    await expect(images.first()).toBeVisible();
    await expect
      .poll(() => images.first().evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });

  // Cubre: RF-COL-02, RF-COL-16
  test("all field types: se renderizan y rellenan los 12 tipos de campo", async ({ page }) => {
    const form = await publishTestForm(
      {
        title: "Todos los tipos",
        fields: [
          { id: "sec", type: "section", label: "Datos", required: false, config: {} },
          text("t", "Texto"),
          { id: "n", type: "number", label: "Número", required: false, config: { decimals: 0 } },
          { id: "d", type: "date", label: "Fecha", required: false, config: {} },
          { id: "tm", type: "time", label: "Hora", required: false, config: {} },
          { id: "dt", type: "datetime", label: "Fecha y hora", required: false, config: {} },
          {
            id: "sc",
            type: "single_choice",
            label: "Una opción",
            required: false,
            config: { display: "radio", options: [{ id: "a", label: "Opción A" }, { id: "b", label: "Opción B" }] },
          },
          {
            id: "mc",
            type: "multiple_choice",
            label: "Varias opciones",
            required: false,
            config: { options: [{ id: "x", label: "Equis" }, { id: "y", label: "Ye" }] },
          },
          { id: "yn", type: "yes_no", label: "Sí o no", required: false, config: {} },
          { id: "ph", type: "photo", label: "Foto", required: false, config: { maxPhotos: 2 } },
          { id: "sg", type: "signature", label: "Firma", required: false, config: {} },
          { id: "gp", type: "gps", label: "GPS", required: false, config: {} },
        ],
      },
      "registered",
    );
    await openFill(page, form.slug);

    await expect(page.getByTestId("section-sec")).toBeVisible();
    await page.getByTestId("field-t").fill("hola");
    await page.getByTestId("field-n").fill("7");
    await page.getByTestId("field-d").fill("2026-11-26");
    await page.getByTestId("field-tm").fill("10:30");
    await page.getByTestId("field-dt").fill("2026-11-26T10:30");
    await page.getByText("Opción B", { exact: true }).click();
    await page.getByText("Equis", { exact: true }).click();
    await page.locator("#field-yn").getByText("Sí", { exact: true }).click();
    await page.getByTestId("photo-input-ph").setInputFiles(photoFile());
    await drawSignature(page, "sg");
    await page.getByRole("button", { name: "Obtener ubicación" }).click();
    await expect(page.getByTestId("gps-value-gp")).toBeVisible();

    await page.getByTestId("save").click();
    await expect(page.getByTestId("save-success")).toBeVisible();

    const [submission] = await submissionsOf(form.id);
    const answers = submission.answers as Record<string, unknown>;
    expect(Object.keys(answers).sort()).toEqual(
      ["d", "dt", "gp", "mc", "n", "ph", "sc", "sg", "t", "tm", "yn"].sort(),
    );
    expect(answers.n).toBe(7);
    expect(answers.sc).toBe("b");
    expect(answers.mc).toEqual(["x"]);
    expect(answers.yn).toBe(true);
  });

  // Cubre: RF-COL-08, RF-COL-16
  test("retry: con la primera petición de guardar abortada, reintentar deja una sola respuesta", async ({
    page,
  }) => {
    const form = await publishTestForm({ title: "Reintento", fields: [text("note", "Nota", true)] }, "registered");
    await openFill(page, form.slug);

    let calls = 0;
    await page.route("**/api/public/forms/*/submissions", (route) => {
      calls += 1;
      return calls === 1 ? route.abort() : route.continue();
    });

    await page.getByTestId("field-note").fill("importante");
    await page.getByTestId("save").click();
    const retry = page.getByRole("button", { name: "No se pudo enviar. Reintentar" });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(page.getByTestId("save-success")).toBeVisible();

    expect(calls).toBe(2);
    expect(await submissionsOf(form.id)).toHaveLength(1);
  });
});

// Cubre: CA-COL-05, RF-COL-15
test("CA-COL-05: Descartar pide confirmación, no guarda y sale; sin nada escrito sale directo", async ({
  page,
}) => {
  const form = await publishTestForm({ title: "Descartar", fields: [text("note", "Nota")] }, "registered");
  await openFill(page, form.slug);

  await page.getByTestId("field-note").fill("a medias");
  await page.getByTestId("discard").click();
  await expect(page.getByTestId("discard-confirm")).toBeVisible();

  await page.getByTestId("discard-cancel").click();
  await expect(page.getByTestId("discard-confirm")).toHaveCount(0);
  await expect(page.getByTestId("field-note")).toHaveValue("a medias");

  await page.getByTestId("discard").click();
  await page.getByTestId("discard-yes").click();
  await page.waitForURL(/\/admin\/forms$/);
  expect(await submissionsOf(form.id)).toHaveLength(0);

  await page.goto(`/f/${form.slug}`);
  await page.getByTestId("discard").click();
  await expect(page.getByTestId("discard-confirm")).toHaveCount(0);
  await page.waitForURL(/\/admin\/forms$/);
  expect(await submissionsOf(form.id)).toHaveLength(0);
});

// Cubre: CA-COL-09, RF-COL-03
test("CA-COL-09: un obligatorio vacío muestra el error junto al campo y no hace POST", async ({ page }) => {
  const form = await publishTestForm(
    { title: "Obligatorio", fields: [text("note", "Nota", true)] },
    "registered",
  );
  await openFill(page, form.slug);

  let posts = 0;
  await page.route("**/api/public/forms/*/submissions", (route) => {
    posts += 1;
    return route.continue();
  });

  await page.getByTestId("save").click();
  const error = page.getByTestId("field-error-note");
  await expect(error).toBeVisible();
  await expect(error).toContainText("obligatorio");
  await expect(page.getByTestId("field-note")).toBeFocused();
  expect(posts).toBe(0);
  expect(await submissionsOf(form.id)).toHaveLength(0);
});

test.describe("sin permiso de ubicación", () => {
  test.use({ permissions: [] });

  // Cubre: CA-COL-09, RF-COL-11
  test("CA-COL-09: GPS obligatorio con permiso denegado muestra el mensaje y no guarda", async ({ page }) => {
    const form = await publishTestForm(
      { title: "GPS", fields: [{ id: "gp", type: "gps", label: "Ubicación", required: true, config: {} }] },
      "registered",
    );
    await openFill(page, form.slug);

    await page.getByRole("button", { name: "Obtener ubicación" }).click();
    await expect(page.getByTestId("gps-message-gp")).toContainText("permiso denegado");

    await page.getByTestId("save").click();
    await expect(page.getByTestId("field-error-gp")).toBeVisible();
    expect(await submissionsOf(form.id)).toHaveLength(0);
  });
});
