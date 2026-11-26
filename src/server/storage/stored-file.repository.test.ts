import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import {
  createIfAbsent,
  findByKey,
  findOrphanFiles,
  linkToSubmission,
} from "./stored-file.repository";

// Requiere PostgreSQL accesible vía DATABASE_URL.

const DAY = 24 * 60 * 60 * 1000;

describe("stored-file.repository", () => {
  let orgA: { id: string };
  let orgB: { id: string };

  const data = (id = randomUUID()) => ({
    key: `org/x/photo/${id}.jpg`,
    uploadId: id,
    kind: "photo" as const,
    contentType: "image/jpeg",
    sizeBytes: 10,
  });

  beforeAll(async () => {
    orgA = await createOrganization({ name: "Org A (stored-file.repository test)" });
    orgB = await createOrganization({ name: "Org B (stored-file.repository test)" });
  });

  afterAll(async () => {
    await prisma.storedFile.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  });

  // Cubre: CA-STO-05
  it("idempotente: createIfAbsent con el mismo uploadId devuelve el existente", async () => {
    const d = data();
    const first = await createIfAbsent(orgA.id, d);
    const second = await createIfAbsent(orgA.id, d);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.record.id).toBe(first.record.id);
  });

  it("idempotente: inserciones simultáneas dejan una sola fila", async () => {
    const d = data();
    const results = await Promise.all([createIfAbsent(orgA.id, d), createIfAbsent(orgA.id, d)]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await prisma.storedFile.count({ where: { uploadId: d.uploadId } })).toBe(1);
  });

  it("idempotente: el mismo uploadId en otra organización es otro archivo", async () => {
    const d = { ...data(), key: `org/y/photo/${randomUUID()}.jpg` };
    const a = await createIfAbsent(orgA.id, d);
    const b = await createIfAbsent(orgB.id, { ...d, key: `${d.key}-b` });
    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
  });

  it("idempotente: findByKey no cruza organizaciones (CA-STO-02)", async () => {
    const d = data();
    await createIfAbsent(orgA.id, d);
    expect(await findByKey(orgA.id, d.key)).not.toBeNull();
    expect(await findByKey(orgB.id, d.key)).toBeNull();
  });

  // Cubre: RF-STO-07, RF-STO-11
  it("huérfanos: findOrphanFiles devuelve los archivos sin submissionId anteriores al corte", async () => {
    const d = data();
    const { record } = await createIfAbsent(orgA.id, d);
    const orphans = await findOrphanFiles(new Date(Date.now() + DAY), orgA.id);
    expect(orphans.map((o) => o.id)).toContain(record.id);
  });

  it("huérfanos: no devuelve los vinculados ni los recientes", async () => {
    const linked = await createIfAbsent(orgA.id, data());
    const recent = await createIfAbsent(orgA.id, data());
    await linkToSubmission(orgA.id, [linked.record.key], "sub-1");

    const cutoffFuture = await findOrphanFiles(new Date(Date.now() + DAY), orgA.id);
    expect(cutoffFuture.map((o) => o.id)).not.toContain(linked.record.id);

    const cutoffPast = await findOrphanFiles(new Date(Date.now() - 7 * DAY), orgA.id);
    expect(cutoffPast.map((o) => o.id)).not.toContain(recent.record.id);
  });

  it("huérfanos: linkToSubmission no toca archivos de otra organización", async () => {
    const { record } = await createIfAbsent(orgA.id, data());
    expect(await linkToSubmission(orgB.id, [record.key], "sub-2")).toBe(0);
    expect(await linkToSubmission(orgA.id, [record.key], "sub-2")).toBe(1);
  });
});
