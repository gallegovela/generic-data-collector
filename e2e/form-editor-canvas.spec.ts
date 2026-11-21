import { expect, test } from "@playwright/test";
import { fieldLabels, login, seedForm, textField, uniqueName } from "./helpers/form-editor";

async function openNewForm(page: import("@playwright/test").Page, fields = [textField("a", "Campo A"), textField("b", "Campo B"), textField("c", "Campo C")]) {
  const id = await seedForm(uniqueName("Canvas"), { title: "Canvas", fields });
  await login(page);
  await page.goto(`/admin/forms/${id}`);
  await expect(page.getByTestId("canvas-field")).toHaveCount(fields.length);
  return id;
}

// Cubre: CA-EDT-01, RF-EDT-04
test("arrastrar el tercer campo a la primera posición persiste el orden", async ({ page }) => {
  const id = await openNewForm(page);
  const handle = page.getByTestId("drag-handle").nth(2);
  const target = page.getByTestId("canvas-field").first();
  const hb = (await handle.boundingBox())!;
  const tb = (await target.boundingBox())!;

  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + 5, hb.y - 20, { steps: 5 });
  await page.mouse.move(tb.x + tb.width / 2, tb.y + 2, { steps: 10 });
  await page.mouse.up();

  await expect.poll(() => fieldLabels(page)).toEqual(["Campo C", "Campo A", "Campo B"]);
  await expect(page.getByTestId("autosave-indicator")).toHaveText("Guardado", { timeout: 10_000 });

  await page.goto(`/admin/forms/${id}`);
  expect(await fieldLabels(page)).toEqual(["Campo C", "Campo A", "Campo B"]);
});

// Cubre: CA-EDT-08, RF-EDT-04
test("reordenar con el teclado da el mismo resultado que arrastrando", async ({ page }) => {
  await openNewForm(page);
  await page.getByTestId("drag-handle").nth(2).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");

  await expect.poll(() => fieldLabels(page)).toEqual(["Campo C", "Campo A", "Campo B"]);
});

// Cubre: CA-EDT-09, RF-EDT-03
test("añadir un campo desde la paleta pulsando y arrastrando", async ({ page }) => {
  await openNewForm(page, []);

  await page.getByTestId("palette-yes_no").click();
  await expect(page.getByTestId("canvas-field")).toHaveCount(1);

  const palette = page.getByTestId("palette-number");
  const pb = (await palette.boundingBox())!;
  const cb = (await page.getByTestId("canvas").boundingBox())!;
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.mouse.down();
  await page.mouse.move(pb.x + pb.width / 2 + 20, pb.y + 10, { steps: 5 });
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height - 5, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByTestId("canvas-field")).toHaveCount(2);
  const labels = await fieldLabels(page);
  expect(labels).toContain("Sí / No");
  expect(labels).toContain("Número");
});
