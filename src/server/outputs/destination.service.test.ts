import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { createDestinationFixture, createFormFixture, deleteOutputsData } from "../../../prisma/fixtures/outputs.fixtures";
import {
  getDestinations,
  regenerateWebhookSecret,
  removeDestination,
  saveEmailDestination,
  saveWebhookDestination,
} from "./destination.service";

// Requiere PostgreSQL accesible vía DATABASE_URL.

describe("destination.service", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let formA: { id: string };

  beforeAll(async () => {
    orgA = await createOrganization({ name: "Org A (destination.service test)" });
    orgB = await createOrganization({ name: "Org B (destination.service test)" });
    formA = await createFormFixture(orgA.id);
  });

  afterAll(() => deleteOutputsData([orgA.id, orgB.id]));

  // Cubre: CA-OUT-09, RF-OUT-16
  it("CA-OUT-09: la organización B sobre el formulario de A recibe NotFoundError y no crea filas", async () => {
    await expect(getDestinations(orgB.id, formA.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(saveEmailDestination(orgB.id, formA.id, { emails: ["x@y.com"] })).rejects.toBeInstanceOf(NotFoundError);
    await expect(saveWebhookDestination(orgB.id, formA.id, { url: "https://example.com/h" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(regenerateWebhookSecret(orgB.id, formA.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(removeDestination(orgB.id, formA.id, "email")).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.destination.count({ where: { formId: formA.id } })).toBe(0);
  });

  it("RF-OUT-16: el secreto solo se devuelve al crear, nunca en la vista, y regenerarlo cambia el valor", async () => {
    const created = await saveWebhookDestination(orgA.id, formA.id, { url: "https://example.com/h" });
    expect(created.secret).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(created.destination.hasSecret).toBe(true);
    expect(JSON.stringify(created.destination)).not.toContain("whsec_");

    const updated = await saveWebhookDestination(orgA.id, formA.id, { url: "https://example.com/h2" });
    expect(updated.secret).toBeNull();
    const stored = await prisma.destination.findFirstOrThrow({ where: { formId: formA.id, kind: "webhook" } });
    expect(stored.webhookSecret).toBe(created.secret);
    expect(stored.webhookUrl).toBe("https://example.com/h2");

    const regenerated = await regenerateWebhookSecret(orgA.id, formA.id);
    expect(regenerated.secret).not.toBe(created.secret);
    const after = await prisma.destination.findFirstOrThrow({ where: { formId: formA.id, kind: "webhook" } });
    expect(after.webhookSecret).toBe(regenerated.secret);

    const views = await getDestinations(orgA.id, formA.id);
    expect(JSON.stringify(views)).not.toContain("whsec_");
  });

  it("RF-OUT-01: el email se guarda normalizado y se actualiza sin crear otro destino", async () => {
    await saveEmailDestination(orgA.id, formA.id, { emails: ["A@x.com", "a@x.com", "b@x.com"] });
    await saveEmailDestination(orgA.id, formA.id, { emails: ["c@x.com"] });
    const rows = await prisma.destination.findMany({ where: { formId: formA.id, kind: "email" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].emailTo).toEqual(["c@x.com"]);
  });

  it("RF-OUT-16: removeDestination borra también sus envíos e intentos y falla si no existe", async () => {
    const form = await createFormFixture(orgA.id, "Otro");
    const destination = await createDestinationFixture(orgA.id, form.id, "email", { emailTo: ["a@x.com"] });
    const delivery = await prisma.delivery.create({
      data: {
        organizationId: orgA.id,
        destinationId: destination.id,
        formId: form.id,
        submissionId: "s1",
        kind: "email",
        nextAttemptAt: new Date(),
      },
    });
    await prisma.deliveryAttempt.create({
      data: { deliveryId: delivery.id, organizationId: orgA.id, number: 1, startedAt: new Date(), durationMs: 1, ok: false },
    });
    await removeDestination(orgA.id, form.id, "email");
    expect(await prisma.destination.count({ where: { formId: form.id } })).toBe(0);
    expect(await prisma.delivery.count({ where: { formId: form.id } })).toBe(0);
    expect(await prisma.deliveryAttempt.count({ where: { deliveryId: delivery.id } })).toBe(0);
    await expect(removeDestination(orgA.id, form.id, "email")).rejects.toBeInstanceOf(NotFoundError);
  });
});
