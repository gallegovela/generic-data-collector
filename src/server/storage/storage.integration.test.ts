import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UnsupportedMediaTypeError } from "@/lib/errors";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { getStorageAdapter, setStorageAdapterForTests } from "./storage-adapter";
import { getSignedFileUrl, uploadFile } from "./storage.service";

// Requiere PostgreSQL y MinIO reales (STORAGE_INTEGRATION=1).
// Cubre: CA-STO-03, CA-STO-04, CA-STO-05 (PP-STO-10).

const enabled = process.env.STORAGE_INTEGRATION === "1";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 8, 7, 6]);

describe.skipIf(!enabled)("storage (PostgreSQL + MinIO)", () => {
  let org: { id: string };

  beforeAll(async () => {
    setStorageAdapterForTests(null);
    org = await createOrganization({ name: "Org (storage.integration test)" });
  });

  afterAll(async () => {
    const files = await prisma.storedFile.findMany({ where: { organizationId: org.id } });
    for (const file of files) await getStorageAdapter().delete(file.key);
    await prisma.storedFile.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.deleteMany({ where: { id: org.id } });
  });

  it("sube un PNG, es idempotente, lo sirve por URL firmada y rechaza un texto", async () => {
    const uploadId = randomUUID();
    const first = await uploadFile(org.id, { kind: "signature", uploadId, bytes: PNG });
    const second = await uploadFile(org.id, { kind: "signature", uploadId, bytes: PNG });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(await prisma.storedFile.count({ where: { organizationId: org.id } })).toBe(1);
    expect(await getStorageAdapter().exists(first.file.key)).toBe(true);

    const { url, expiresInSeconds } = await getSignedFileUrl(org.id, first.file.key);
    expect(expiresInSeconds).toBeLessThanOrEqual(900);
    const downloaded = new Uint8Array(await (await fetch(url)).arrayBuffer());
    expect(downloaded).toEqual(PNG);

    await expect(
      uploadFile(org.id, {
        kind: "photo",
        uploadId: randomUUID(),
        bytes: new Uint8Array(Array.from("texto plano", (c) => c.charCodeAt(0))),
      }),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
    expect(await prisma.storedFile.count({ where: { organizationId: org.id } })).toBe(1);
  });
});
