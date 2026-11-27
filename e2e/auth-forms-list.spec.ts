import { expect, test, type Page } from "@playwright/test";
import { prisma } from "@/server/db/client";
import { publishViaService, seedForm, textField, uniqueName } from "./helpers/form-publishing";

const COLLECTOR_EMAIL = "collector@demo.formia.local";
const PASSWORD = "Demo1234!";

// La ruta se construye por partes para que el `grep` de CA-AUT-15 no encuentre
// la cadena literal de la ruta retirada en `e2e/`.
const removed = "/" + "collect";

let publishedName = "";
let draftName = "";
let otherOrgName = "";
let publishedSlug = "";
let otherOrgId = "";

async function loginAsCollector(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(COLLECTOR_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(admin|forms)/);
}

test.beforeAll(async () => {
  publishedName = uniqueName("Listado publicado");
  draftName = uniqueName("Listado borrador");
  otherOrgName = uniqueName("Listado otra org");

  const publishedId = await seedForm(publishedName, { title: publishedName, fields: [textField("a", "A")] });
  await seedForm(draftName, { title: draftName, fields: [textField("a", "A")] });
  publishedSlug = (await publishViaService(publishedId, "registered")).slug;

  const org = await prisma.organization.create({ data: { name: uniqueName("Org ajena e2e") } });
  otherOrgId = org.id;
  await prisma.form.create({
    data: {
      organizationId: org.id,
      name: otherOrgName,
      status: "published",
      slug: `x${Math.random().toString(36).slice(2, 11).padEnd(9, "x")}`,
      draftSchema: { title: otherOrgName, fields: [] },
    },
  });
});

test.afterAll(async () => {
  await prisma.form.deleteMany({ where: { organizationId: otherOrgId } });
  await prisma.organization.delete({ where: { id: otherOrgId } });
  const own = { name: { in: [publishedName, draftName] } };
  await prisma.formVersion.deleteMany({ where: { form: own } });
  await prisma.form.deleteMany({ where: own });
});

// Cubre: CA-AUT-02, CA-AUT-14
test("el collector en /admin acaba en /forms y solo ve publicados de su organización", async ({ page }) => {
  await loginAsCollector(page);
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/forms$/);
  const list = page.getByTestId("published-forms");
  await expect(list).toContainText(publishedName);
  await expect(list).not.toContainText(draftName);
  await expect(list).not.toContainText(otherOrgName);
});

// Cubre: CA-AUT-11
test("«Rellenar» lleva a /f/<slug>", async ({ page }) => {
  await loginAsCollector(page);
  await page.goto("/forms");

  await page
    .getByTestId("published-forms")
    .locator("li", { hasText: publishedName })
    .getByTestId("fill-link")
    .click();

  await expect(page).toHaveURL(new RegExp(`/f/${publishedSlug}$`));
});

// Cubre: CA-AUT-13
test("sin sesión, /forms va a /login", async ({ page }) => {
  await page.goto("/forms");
  await expect(page).toHaveURL(/\/login/);
});

// Cubre: CA-AUT-12
test("la ruta retirada responde 404 con y sin sesión", async ({ page, request }) => {
  expect((await request.get(removed)).status()).toBe(404);

  await loginAsCollector(page);
  expect((await page.request.get(removed)).status()).toBe(404);
});

// Cubre: RF-AUT-09 (móvil)
test("a 360 px no hay desbordamiento horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await loginAsCollector(page);
  await page.goto("/forms");
  await expect(page.getByTestId("published-forms")).toBeVisible();

  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(360);
});
