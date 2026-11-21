import { expect, test } from "@playwright/test";
import { login, seedForm, textField, uniqueName, waitSaved } from "./helpers/form-editor";

async function open(page: import("@playwright/test").Page, fields: Parameters<typeof seedForm>[1]["fields"]) {
  const id = await seedForm(uniqueName("Autosave"), { title: "Autosave", fields });
  await login(page);
  await page.goto(`/admin/forms/${id}`);
  return id;
}

// Cubre: CA-EDT-03, RF-EDT-08
test("editar un campo se autoguarda a los 2 s", async ({ page }) => {
  await open(page, [textField("a", "Campo A")]);
  await page.getByTestId("field-select").click();
  await page.getByLabel("Etiqueta").fill("Nombre del encargado");

  await waitSaved(page);
});

// Cubre: CA-EDT-10, RF-EDT-05
test("etiqueta, descripción, obligatorio y opciones persisten tras recargar", async ({ page }) => {
  const id = await open(page, [
    {
      id: "sel",
      type: "single_choice",
      label: "Selección",
      required: false,
      config: { options: [{ id: "o1", label: "Uno" }, { id: "o2", label: "Dos" }], display: "radio" },
    },
  ]);
  await page.getByTestId("field-select").click();
  await page.getByLabel("Etiqueta").fill("Turno");
  await page.getByLabel("Descripción").fill("Elige el turno");
  await page.getByLabel("Obligatorio").click();
  await page.getByLabel("Opción 1", { exact: true }).fill("Mañana");
  await waitSaved(page);

  await page.goto(`/admin/forms/${id}`);
  await page.getByTestId("field-select").click();
  await expect(page.getByLabel("Etiqueta")).toHaveValue("Turno");
  await expect(page.getByLabel("Descripción")).toHaveValue("Elige el turno");
  await expect(page.getByLabel("Obligatorio")).toBeChecked();
  await expect(page.getByLabel("Opción 1", { exact: true })).toHaveValue("Mañana");
});

// Cubre: CA-EDT-07, RF-EDT-10
test("un single_choice sin opciones bloquea el guardado y señala el campo", async ({ page }) => {
  await open(page, [
    {
      id: "sel",
      type: "single_choice",
      label: "Selección",
      required: false,
      config: { options: [{ id: "o1", label: "Uno" }], display: "radio" },
    },
  ]);
  await page.getByTestId("field-select").click();
  await page.getByRole("button", { name: "Quitar opción 1" }).click();

  await expect(page.getByTestId("autosave-indicator")).toContainText("No se puede guardar: revisa «Selección»", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("autosave-indicator")).not.toHaveText("Guardado");
});

// Cubre: CA-EDT-12, RF-EDT-07
test("una condición de visibilidad válida persiste tras recargar", async ({ page }) => {
  const id = await open(page, [
    { id: "inc", type: "yes_no", label: "¿Hay incidencias?", required: false, config: {} },
    textField("com", "Comentario"),
  ]);
  await page.getByTestId("field-select").nth(1).click();
  await page.getByRole("button", { name: "Mostrar solo si…" }).click();
  await page.getByLabel("Condición").selectOption("equals");
  await page.getByLabel("Valor").selectOption("true");
  await waitSaved(page);

  await page.goto(`/admin/forms/${id}`);
  await page.getByTestId("field-select").nth(1).click();
  await expect(page.getByLabel("Mostrar este campo solo si")).toHaveValue("inc");
  await expect(page.getByLabel("Condición")).toHaveValue("equals");
  await expect(page.getByLabel("Valor")).toHaveValue("true");
});
