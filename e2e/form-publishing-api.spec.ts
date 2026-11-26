import { expect, test } from "@playwright/test";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { createForm } from "@/server/forms/form.repository";
import { publishForm } from "@/server/form-publishing/form-publishing.service";
import { unpublishForm } from "@/server/form-publishing/form-publishing.service";
import { findUserByEmail } from "@/server/auth/user.repository";
import { ADMIN_EMAIL } from "./helpers/form-editor";
import { login, publishViaService, seedForm, textField, uniqueName } from "./helpers/form-publishing";

const FIELDS = [textField("a", "Campo A")];

// Cubre: CA-PUB-04
test("CA-PUB-04: la API pública respeta el modo de acceso", async ({ request, page }) => {
  const registeredId = await seedForm(uniqueName("ApiReg"), { title: "Reg", fields: FIELDS });
  const publicId = await seedForm(uniqueName("ApiPub"), { title: "Pub", fields: FIELDS });
  const registered = await publishViaService(registeredId, "registered");
  const pub = await publishViaService(publicId, "public");

    expect((await request.get(`/api/public/forms/${registered.slug}`)).status()).toBe(401);
    const ok = await request.get(`/api/public/forms/${pub.slug}`);
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(body.schema.fields).toHaveLength(1);
    expect(body.organizationId).toBeUndefined();
    expect((await request.get("/api/public/forms/zzzzzzzzzz")).status()).toBe(404);

  await login(page);
  expect((await page.request.get(`/api/public/forms/${registered.slug}`)).status()).toBe(200);
});

// Cubre: CA-PUB-06
test("CA-PUB-06: un formulario despublicado responde 410", async ({ page }) => {
  const id = await seedForm(uniqueName("ApiClosed"), { title: "Closed", fields: FIELDS });
  const { slug } = await publishViaService(id, "public");
  const admin = await findUserByEmail(ADMIN_EMAIL);
  await unpublishForm(admin!.organizationId, id);
  expect((await page.request.get(`/api/public/forms/${slug}`)).status()).toBe(410);
});

// Cubre: CA-PUB-05
test("CA-PUB-05: el QR de un formulario de otra organización da 404", async ({ page }) => {
  const other = await createOrganization({ name: uniqueName("Otra org") });
  try {
    const form = await createForm(other.id, {
      name: "Ajeno",
      draft: { title: "Ajeno", fields: FIELDS },
    });
    await publishForm(other.id, "u", form.id, { accessMode: "public" });
    await login(page);
    expect((await page.request.get(`/api/forms/${form.id}/qr?format=png`)).status()).toBe(404);
  } finally {
    await prisma.formVersion.deleteMany({ where: { organizationId: other.id } });
    await prisma.form.deleteMany({ where: { organizationId: other.id } });
    await prisma.organization.delete({ where: { id: other.id } });
  }
});
