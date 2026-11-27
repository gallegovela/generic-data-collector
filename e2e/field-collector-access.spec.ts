import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { FILL_RATE_LIMITS } from "@/lib/field-collector/fill.schema";
import { hashPassword } from "@/server/auth/auth.service";
import { saveDraft } from "@/server/forms/form.service";
import { prisma } from "@/server/db/client";
import { JPEG_MIN, photoFile } from "./fixtures/images";
import {
  publishTestForm,
  submissionsOf,
  textField,
  unpublishTestForm,
} from "./helpers/field-collector";
import { publishViaService } from "./helpers/form-publishing";
import { demoOrganizationId } from "./helpers/submissions-dashboard";

const PASSWORD = "Demo1234!";
const OTHER_EMAIL = `e2e-collector-${Date.now()}@other.formia.local`;
let otherOrgId: string;

test.beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `Otra org e2e ${Date.now()}` } });
  otherOrgId = org.id;
  await prisma.user.create({
    data: {
      organizationId: org.id,
      email: OTHER_EMAIL,
      name: "Usuario Otra Org",
      role: "admin",
      status: "active",
      passwordHash: await hashPassword(PASSWORD),
    },
  });
});

test.afterAll(async () => {
  await prisma.storedFile.deleteMany({ where: { organizationId: otherOrgId } });
  await prisma.user.deleteMany({ where: { organizationId: otherOrgId } });
  await prisma.organization.deleteMany({ where: { id: otherOrgId } });
});

async function loginAsOtherOrg(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(OTHER_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/admin/);
}

const FORM = {
  title: "Acceso",
  fields: [
    textField("note", "Nota"),
    { id: "photos", type: "photo" as const, label: "Fotos", required: false, config: {} },
  ],
};

function uniqueIp(): string {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
}

function upload(
  request: APIRequestContext,
  slug: string,
  opts: { kind?: string; buffer?: Buffer; mimeType?: string; ip?: string } = {},
) {
  return request.post(`/api/public/forms/${slug}/files`, {
    headers: { "x-forwarded-for": opts.ip ?? uniqueIp() },
    multipart: {
      file: { name: "f.bin", mimeType: opts.mimeType ?? "image/png", buffer: opts.buffer ?? photoFile().buffer },
      kind: opts.kind ?? "photo",
      uploadId: randomUUID(),
    },
  });
}

function save(
  request: APIRequestContext,
  slug: string,
  versionId: string,
  extra: Record<string, unknown> = {},
  ip: string = uniqueIp(),
) {
  return request.post(`/api/public/forms/${slug}/submissions`, {
    headers: { "x-forwarded-for": ip },
    data: {
      clientId: randomUUID(),
      versionId,
      capturedAt: new Date().toISOString(),
      answers: { note: "hola" },
      ...extra,
    },
  });
}

async function versionIdOf(formId: string): Promise<string> {
  const version = await prisma.formVersion.findFirstOrThrow({
    where: { formId },
    orderBy: { version: "desc" },
  });
  return version.id;
}

// Cubre: CA-COL-06, RF-COL-17
test("CA-COL-06: registered exige sesión de la organización en la página y en los dos endpoints", async ({
  page,
  request,
}) => {
  const form = await publishTestForm(FORM, "registered");
  const versionId = await versionIdOf(form.id);

  await page.goto(`/f/${form.slug}`);
  await page.waitForURL(/\/login/);

  expect((await upload(request, form.slug)).status()).toBe(401);
  expect((await save(request, form.slug, versionId)).status()).toBe(401);

  await loginAsOtherOrg(page);
  await page.goto(`/f/${form.slug}`);
  await expect(page.getByTestId("access-forbidden")).toContainText("No tienes acceso");

  const forbiddenUploadId = randomUUID();
  const forbiddenUpload = await page.request.post(`/api/public/forms/${form.slug}/files`, {
    multipart: { file: photoFile(), kind: "photo", uploadId: forbiddenUploadId },
  });
  expect(forbiddenUpload.status()).toBe(403);
  const forbiddenSave = await page.request.post(`/api/public/forms/${form.slug}/submissions`, {
    data: { clientId: randomUUID(), versionId, capturedAt: new Date().toISOString(), answers: {} },
  });
  expect(forbiddenSave.status()).toBe(403);

  expect(await submissionsOf(form.id)).toHaveLength(0);
  expect(await prisma.storedFile.count({ where: { uploadId: forbiddenUploadId } })).toBe(0);
});

// Cubre: CA-COL-07, RF-COL-17, RF-COL-18
test("CA-COL-07: anónimo rellena un formulario public y termina en /thanks", async ({ page, request }) => {
  const form = await publishTestForm(FORM, "public");

  await page.goto(`/f/${form.slug}`);
  await page.getByTestId("field-note").fill("anónimo");
  await page.getByTestId("save").click();
  await expect(page.getByTestId("save-success")).toBeVisible();
  await page.waitForURL(new RegExp(`/f/${form.slug}/thanks$`));
  await expect(page.getByTestId("thanks")).toBeVisible();

  const [submission] = await submissionsOf(form.id);
  expect(submission.organizationId).toBe(await demoOrganizationId());
  expect(submission.submittedByUserId).toBeNull();
  expect(submission.submittedByName).toBeNull();

  // Una clave de archivo de otra organización en el cuerpo se rechaza (400).
  const versionId = await versionIdOf(form.id);
  const response = await save(request, form.slug, versionId, {
    answers: { photos: [{ key: `org/${otherOrgId}/photo/${randomUUID()}.png` }] },
  });
  expect(response.status()).toBe(400);
  expect(await submissionsOf(form.id)).toHaveLength(1);
  expect(await prisma.submission.count({ where: { organizationId: otherOrgId } })).toBe(0);
});

// Cubre: CA-COL-08, RF-COL-17
test("CA-COL-08: despublicado, la página muestra form-closed y los endpoints responden 410", async ({
  page,
  request,
}) => {
  const form = await publishTestForm(FORM, "public");
  const versionId = await versionIdOf(form.id);
  await unpublishTestForm(form.id);

  await page.goto(`/f/${form.slug}`);
  await expect(page.getByTestId("form-closed")).toBeVisible();
  expect((await upload(request, form.slug)).status()).toBe(410);
  expect((await save(request, form.slug, versionId)).status()).toBe(410);
  expect(await submissionsOf(form.id)).toHaveLength(0);
});

// Cubre: CA-COL-08
test("CA-COL-08: rellenada con v1 mientras se publica v2 se guarda con v1", async ({ page }) => {
  const form = await publishTestForm(FORM, "public");
  await page.goto(`/f/${form.slug}`);
  await page.getByTestId("field-note").fill("con v1");

  const orgId = await demoOrganizationId();
  await saveDraft(orgId, form.id, {
    draft: { title: "Acceso v2", fields: [textField("note", "Nota"), textField("extra", "Extra")] },
  });
  await publishViaService(form.id, "public");

  await page.getByTestId("save").click();
  await expect(page.getByTestId("save-success")).toBeVisible();
  const [submission] = await submissionsOf(form.id);
  expect(submission.formVersionNumber).toBe(1);
});

// Cubre: CA-COL-10, RF-COL-19
test("CA-COL-10: tras el límite de guardados, 429 con Retry-After; otra IP y otro formulario no se bloquean", async ({
  request,
}) => {
  const form = await publishTestForm(FORM, "public");
  const other = await publishTestForm(FORM, "public");
  const versionId = await versionIdOf(form.id);
  const tail = uniqueIp();

  // Cambiar el primer valor de x-forwarded-for no evita el límite.
  for (let i = 0; i < FILL_RATE_LIMITS.submit.limit; i++) {
    await request.post(`/api/public/forms/${form.slug}/submissions`, {
      headers: { "x-forwarded-for": `9.9.9.${i % 250}, ${tail}` },
      data: {},
    });
  }
  const limited = await save(request, form.slug, versionId, {}, `1.2.3.4, ${tail}`);
  expect(limited.status()).toBe(429);
  expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);

  expect((await save(request, form.slug, versionId)).status()).toBe(201);
  expect((await save(request, other.slug, await versionIdOf(other.id), {}, tail)).status()).toBe(201);
});

// Cubre: CA-COL-10, RF-COL-19
test("CA-COL-10: tras el límite de subidas, 429 con Retry-After", async ({ request }) => {
  const form = await publishTestForm(FORM, "public");
  const ip = uniqueIp();
  for (let i = 0; i < FILL_RATE_LIMITS.upload.limit; i++) {
    await request.post(`/api/public/forms/${form.slug}/files`, {
      headers: { "x-forwarded-for": ip },
      multipart: { kind: "photo" },
    });
  }
  const limited = await upload(request, form.slug, { ip });
  expect(limited.status()).toBe(429);
  expect(limited.headers()["retry-after"]).toBeTruthy();
});

// Cubre: CA-COL-10, RF-COL-18
test("CA-COL-10: GET de archivos 405, kind document 400, no imagen 415, más de 10 MB 413", async ({
  request,
}) => {
  const form = await publishTestForm(FORM, "public");

  expect((await request.get(`/api/public/forms/${form.slug}/files`)).status()).toBe(405);
  expect((await upload(request, form.slug, { kind: "document" })).status()).toBe(400);
  expect(
    (
      await upload(request, form.slug, {
        buffer: Buffer.from("%PDF-1.7 documento"),
        mimeType: "application/pdf",
      })
    ).status(),
  ).toBe(415);
  expect(
    (
      await upload(request, form.slug, {
        buffer: Buffer.concat([JPEG_MIN, Buffer.alloc(11 * 1024 * 1024)]),
        mimeType: "image/jpeg",
      })
    ).status(),
  ).toBe(413);
  expect((await upload(request, form.slug)).status()).toBe(201);
});

// Cubre: CA-COL-10, RF-COL-19
test("CA-COL-10: honeypot relleno responde 201 sin guardar y capturedAt futuro da 400", async ({ request }) => {
  const form = await publishTestForm(FORM, "public");
  const versionId = await versionIdOf(form.id);

  const bot = await save(request, form.slug, versionId, { website: "http://spam.example" });
  expect(bot.status()).toBe(201);
  expect(await submissionsOf(form.id)).toHaveLength(0);

  const future = await save(request, form.slug, versionId, {
    capturedAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
  });
  expect(future.status()).toBe(400);
  expect(await submissionsOf(form.id)).toHaveLength(0);
});
