import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { createDestinationFixture, createFormFixture, deleteOutputsData } from "../../../prisma/fixtures/outputs.fixtures";
import { claimDelivery, createDeliveries } from "./delivery.repository";

// Requiere PostgreSQL accesible vía DATABASE_URL.

describe("delivery.repository", () => {
  let org: { id: string };
  let formId: string;
  let destinationId: string;

  beforeAll(async () => {
    org = await createOrganization({ name: "Org (delivery.repository test)" });
    formId = (await createFormFixture(org.id)).id;
    destinationId = (await createDestinationFixture(org.id, formId, "email", { emailTo: ["a@x.com"] })).id;
  });

  afterAll(() => deleteOutputsData([org.id]));

  const row = (submissionId: string) => ({
    organizationId: org.id,
    destinationId,
    formId,
    submissionId,
    kind: "email" as const,
    nextAttemptAt: new Date(Date.now() - 1000),
  });

  // Cubre: CA-OUT-08
  it("CA-OUT-08: insertar dos veces (destinationId, submissionId) deja una sola fila", async () => {
    await createDeliveries([row("dup")]);
    await createDeliveries([row("dup")]);
    expect(await prisma.delivery.count({ where: { destinationId, submissionId: "dup" } })).toBe(1);
  });

  it("CA-OUT-08: el reclamo es atómico (dos claimDelivery simultáneos: gana uno)", async () => {
    await createDeliveries([row("claim")]);
    const found = await prisma.delivery.findFirstOrThrow({ where: { destinationId, submissionId: "claim" } });
    const now = new Date();
    const results = await Promise.all([claimDelivery(found.id, now), claimDelivery(found.id, now)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    // Un envío `sending` reciente no se reclama de nuevo.
    expect(await claimDelivery(found.id, now)).toBe(false);
  });
});
