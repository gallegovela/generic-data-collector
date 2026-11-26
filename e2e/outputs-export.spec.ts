import ExcelJS from "exceljs";
import { expect, test } from "@playwright/test";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { createSubmissionFixture } from "@/server/submissions/submission.repository";
import { buildDailyReportFormVersion, buildDailyReportFormVersionV2 } from "../prisma/fixtures/submissions-dashboard.fixtures";
import { login } from "./helpers/form-editor";
import { addSubmission, deleteSubmissionsOfForms, demoOrganizationId, uniqueFormId } from "./helpers/submissions-dashboard";

const formId = uniqueFormId("export");
const foreignFormId = uniqueFormId("export-foreign");
const missingFormId = uniqueFormId("export-missing");
let foreignOrgId = "";

const url = (id: string, search: string) => `/api/forms/${id}/submissions/export?${search}`;

test.beforeAll(async () => {
  const org = await demoOrganizationId();
  // El listado va de más reciente a más antigua: n=1 (v2) antes que n=2 (v1).
  await addSubmission(org, formId, 2, { formVersionNumber: 1, answers: { site: "=1+1", has_incidents: false } });
  await addSubmission(org, formId, 1, {
    formVersion: buildDailyReportFormVersionV2(),
    formVersionNumber: 2,
    answers: { site: "Obra 2", has_incidents: true, weather: "Sol" },
  });
  const foreign = await createOrganization({ name: `Org ajena (outputs-export ${formId})` });
  foreignOrgId = foreign.id;
  await createSubmissionFixture(foreign.id, {
    formId: foreignFormId,
    formTitle: "Ajeno",
    clientId: `${foreignFormId}-1`,
    formVersionSnapshot: buildDailyReportFormVersion(),
    answers: { site: "Secreto" },
    capturedAt: new Date(),
  });
});

test.afterAll(async () => {
  await deleteSubmissionsOfForms([formId]);
  await prisma.submission.deleteMany({ where: { organizationId: foreignOrgId } });
  await prisma.organization.deleteMany({ where: { id: foreignOrgId } });
});

// Cubre: CA-OUT-02, CA-OUT-04, CA-OUT-05
test("CA-OUT-04: el CSV tiene BOM, una columna por campo y neutraliza fórmulas (CA-OUT-05)", async ({ page }) => {
  await login(page);
  const response = await page.request.get(url(formId, "format=csv"));

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv; charset=utf-8");
  expect(response.headers()["content-disposition"]).toContain("attachment");
  const text = (await response.body()).toString("utf8");
  expect(text.startsWith("﻿")).toBe(true);

  const [header, ...rows] = text.slice(1).split("\r\n");
  const columns = header.split(";");
  expect(columns.filter((c) => c === "Tiempo")).toHaveLength(1);
  expect(rows).toHaveLength(2);
  const weather = columns.indexOf("Tiempo");
  const site = columns.indexOf("Obra");
  const [v2, v1] = rows.map((r) => r.split(";"));
  expect(v2[weather]).toBe("Sol");
  expect(v1[weather]).toBe("");
  expect(v1[site]).toBe("'=1+1");
});

// Cubre: CA-OUT-02
test("CA-OUT-02: el xlsx se descarga con su tipo MIME y respeta los filtros", async ({ page }) => {
  await login(page);
  const response = await page.request.get(url(formId, "format=xlsx&q=Obra%202"));

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await response.body()) as unknown as ArrayBuffer);
  expect(wb.getWorksheet("Respuestas")?.rowCount).toBe(2);
});

// Cubre: CA-OUT-06
test("CA-OUT-06: 401 sin sesión, 403 como collector y 404 de otra organización o inexistente", async ({
  page,
  request,
  browser,
}) => {
  expect((await request.get(url(formId, "format=csv"))).status()).toBe(401);

  const context = await browser.newContext();
  const collectorPage = await context.newPage();
  await collectorPage.goto("/login");
  await collectorPage.getByLabel("Email").fill("collector@demo.formia.local");
  await collectorPage.getByLabel("Contraseña").fill("Demo1234!");
  await collectorPage.getByRole("button", { name: "Entrar" }).click();
  // No se espera a la página /collect: basta con que la sesión exista.
  await expect
    .poll(async () => (await collectorPage.request.get(url(formId, "format=csv"))).status(), { timeout: 15_000 })
    .toBe(403);
  await context.close();

  await login(page);
  const foreign = await page.request.get(url(foreignFormId, "format=csv"));
  const missing = await page.request.get(url(missingFormId, "format=csv"));
  expect(foreign.status()).toBe(404);
  expect(missing.status()).toBe(404);
  expect(await foreign.text()).toBe(await missing.text());
  expect(await foreign.text()).not.toContain("Secreto");
});

// Cubre: CA-OUT-02
test("CA-OUT-02: 400 con formato desconocido o ausente", async ({ page }) => {
  await login(page);
  expect((await page.request.get(url(formId, "format=pdf"))).status()).toBe(400);
  expect((await page.request.get(url(formId, ""))).status()).toBe(400);
});

// Cubre: CA-OUT-02, RF-OUT-05
test("CA-OUT-02: el listado muestra los enlaces de exportación con los filtros activos", async ({ page }) => {
  await login(page);
  await page.goto(`/admin/forms/${formId}/submissions?submittedBy=Ana`);

  const excel = page.getByRole("link", { name: "Exportar a Excel" });
  const csv = page.getByRole("link", { name: "Exportar a CSV" });
  await expect(excel).toHaveAttribute("href", /format=xlsx.*submittedBy=Ana/);
  await expect(csv).toHaveAttribute("href", /format=csv.*submittedBy=Ana/);
  await expect(csv).not.toHaveAttribute("href", /page=/);
});
