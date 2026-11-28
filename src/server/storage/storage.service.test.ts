import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConflictError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "@/lib/errors";
import { ensureGenericPlan } from "@/server/admin-settings/test-helpers";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { InMemoryStorageAdapter } from "./in-memory-storage-adapter";
import { setStorageAdapterForTests } from "./storage-adapter";
import { getSignedFileUrl, uploadFile } from "./storage.service";

// Requiere PostgreSQL accesible vía DATABASE_URL (npm run test:stack:run -- npm test).

const text = (value: string) => Array.from(value, (c) => c.charCodeAt(0));
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const PDF = new Uint8Array(text("%PDF-1.7 contenido"));

describe("storage.service", () => {
  let org: { id: string };
  let otherOrg: { id: string };
  let adapter: InMemoryStorageAdapter;

  beforeAll(async () => {
    org = await createOrganization({ name: "Org (storage.service test)" });
    otherOrg = await createOrganization({ name: "Otra org (storage.service test)" });
  });

  beforeEach(() => {
    adapter = new InMemoryStorageAdapter();
    setStorageAdapterForTests(adapter);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await prisma.storedFile.deleteMany({
      where: { organizationId: { in: [org.id, otherOrg.id] } },
    });
  });

  afterAll(async () => {
    setStorageAdapterForTests(null);
    await prisma.organization.deleteMany({ where: { id: { in: [org.id, otherOrg.id] } } });
  });

  async function expectNothingStored() {
    expect(adapter.objects.size).toBe(0);
    expect(await prisma.storedFile.count({ where: { organizationId: org.id } })).toBe(0);
  }

  // Cubre: RF-STO-01
  it("guarda con la clave org/<org>/<kind>/<uploadId>.<ext>", async () => {
    const uploadId = randomUUID();
    const { file, created } = await uploadFile(org.id, { kind: "photo", uploadId, bytes: JPG });
    expect(created).toBe(true);
    expect(file.key).toBe(`org/${org.id}/photo/${uploadId}.jpg`);
    expect(adapter.objects.get(file.key)?.contentType).toBe("image/jpeg");
  });

  // Cubre: CA-STO-04
  it("rechaza un texto con extensión .jpg (415) sin guardar nada", async () => {
    const bytes = new Uint8Array(text("esto no es una imagen"));
    await expect(
      uploadFile(org.id, { kind: "photo", uploadId: randomUUID(), bytes }),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
    await expectNothingStored();
  });

  it("rechaza una foto como firma que no es PNG (415) sin guardar nada", async () => {
    await expect(
      uploadFile(org.id, { kind: "signature", uploadId: randomUUID(), bytes: JPG }),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
    await expectNothingStored();
  });

  it("rechaza un PDF como foto (415) sin guardar nada", async () => {
    await expect(
      uploadFile(org.id, { kind: "photo", uploadId: randomUUID(), bytes: PDF }),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
    await expectNothingStored();
  });

  it("rechaza 10 MB + 1 byte (413) sin guardar nada", async () => {
    const bytes = new Uint8Array(10 * 1024 * 1024 + 1);
    bytes.set(JPG);
    await expect(
      uploadFile(org.id, { kind: "photo", uploadId: randomUUID(), bytes }),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);
    await expectNothingStored();
  });

  it("rechaza un archivo vacío (400) sin guardar nada", async () => {
    await expect(
      uploadFile(org.id, { kind: "photo", uploadId: randomUUID(), bytes: new Uint8Array() }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expectNothingStored();
  });

  // Cubre: CA-STO-05
  it("subida idempotente: la misma subida dos veces da la misma clave, 1 fila y 1 objeto", async () => {
    const uploadId = randomUUID();
    const first = await uploadFile(org.id, { kind: "photo", uploadId, bytes: JPG });
    const second = await uploadFile(org.id, { kind: "photo", uploadId, bytes: JPG });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.file.key).toBe(first.file.key);
    expect(adapter.objects.size).toBe(1);
    expect(await prisma.storedFile.count({ where: { organizationId: org.id } })).toBe(1);
  });

  it("subida idempotente: dos subidas simultáneas con el mismo uploadId dejan 1 fila", async () => {
    const uploadId = randomUUID();
    const [a, b] = await Promise.all([
      uploadFile(org.id, { kind: "photo", uploadId, bytes: JPG }),
      uploadFile(org.id, { kind: "photo", uploadId, bytes: JPG }),
    ]);
    expect(a.file.key).toBe(b.file.key);
    expect(await prisma.storedFile.count({ where: { organizationId: org.id } })).toBe(1);
    expect(adapter.objects.size).toBe(1);
  });

  it("subida idempotente: simultáneas con distinto tipo (JPG y PNG) dejan 1 fila y 1 solo objeto", async () => {
    const uploadId = randomUUID();
    await Promise.allSettled([
      uploadFile(org.id, { kind: "photo", uploadId, bytes: JPG }),
      uploadFile(org.id, { kind: "photo", uploadId, bytes: PNG }),
    ]);
    const rows = await prisma.storedFile.findMany({ where: { organizationId: org.id } });
    expect(rows).toHaveLength(1);
    expect(adapter.objects.size).toBe(1);
    expect(adapter.objects.has(rows[0].key)).toBe(true);
  });

  it("subida idempotente: el mismo uploadId con otro kind lanza ConflictError", async () => {
    const uploadId = randomUUID();
    await uploadFile(org.id, { kind: "signature", uploadId, bytes: PNG });
    await expect(
      uploadFile(org.id, { kind: "photo", uploadId, bytes: PNG }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(adapter.objects.size).toBe(1);
  });

  // Cubre: CA-STO-03
  it("URL firmada: devuelve una URL con vida ≤ 900 s", async () => {
    const { file } = await uploadFile(org.id, {
      kind: "photo",
      uploadId: randomUUID(),
      bytes: JPG,
    });
    const signed = await getSignedFileUrl(org.id, file.key);
    expect(signed.url).toContain(file.key);
    expect(signed.expiresInSeconds).toBeGreaterThan(0);
    expect(signed.expiresInSeconds).toBeLessThanOrEqual(900);
  });

  // Cubre: CA-STO-02
  it("archivo de otra organización: NotFoundError", async () => {
    const { file } = await uploadFile(org.id, {
      kind: "photo",
      uploadId: randomUUID(),
      bytes: JPG,
    });
    await expect(getSignedFileUrl(otherOrg.id, file.key)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("archivo de otra organización: una clave inexistente da el mismo NotFoundError", async () => {
    await expect(
      getSignedFileUrl(org.id, `org/${org.id}/photo/${randomUUID()}.jpg`),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  // Cubre: RNF-STO-04
  it("log de subida solo contiene key y sizeBytes", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const uploadId = randomUUID();
    const { file } = await uploadFile(org.id, { kind: "photo", uploadId, bytes: JPG });
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(String(spy.mock.calls[0][0])) as Record<string, unknown>;
    expect(logged).toEqual({
      event: "file.uploaded",
      key: file.key,
      sizeBytes: JPG.byteLength,
    });
  });
});

// Cubre: CA-SET-04, CA-STO-06, RF-STO-12
describe("límite de plan (uploadFile)", () => {
  const MB = 1048576;
  const jpgOfSize = (size: number) => {
    const bytes = new Uint8Array(size);
    bytes.set(JPG);
    return bytes;
  };
  let plan: { id: string };
  let org: { id: string };
  let adapter: InMemoryStorageAdapter;

  const setLimit = (maxFileBytes: number | null) =>
    prisma.plan.update({ where: { id: plan.id }, data: { maxFileBytes } });

  beforeAll(async () => {
    await ensureGenericPlan();
    plan = await prisma.plan.create({ data: { name: `Plan storage test ${randomUUID()}`, maxFileBytes: MB } });
    org = await createOrganization({ name: "Org (límite de plan storage test)", planId: plan.id });
  });

  beforeEach(async () => {
    adapter = new InMemoryStorageAdapter();
    setStorageAdapterForTests(adapter);
    await setLimit(MB);
  });

  afterEach(async () => {
    await prisma.storedFile.deleteMany({ where: { organizationId: org.id } });
  });

  afterAll(async () => {
    setStorageAdapterForTests(null);
    await prisma.organization.deleteMany({ where: { id: org.id } });
    await prisma.plan.deleteMany({ where: { id: plan.id } });
  });

  describe("límite de tamaño", () => {
    it("un archivo de 2 MB se rechaza con el mensaje del plan y no se guarda", async () => {
      const err = await uploadFile(org.id, { kind: "photo", uploadId: randomUUID(), bytes: jpgOfSize(2 * MB) }).catch(
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(PayloadTooLargeError);
      expect((err as Error).message).toContain("tamaño máximo de tu plan");
      expect((err as Error).message).toContain("1 MB");
      expect(adapter.objects.size).toBe(0);
      expect(await prisma.storedFile.count({ where: { organizationId: org.id } })).toBe(0);
    });

    it("un archivo de 500 KB se acepta", async () => {
      const r = await uploadFile(org.id, { kind: "photo", uploadId: randomUUID(), bytes: jpgOfSize(500 * 1024) });
      expect(r.created).toBe(true);
    });

    it("un archivo de exactamente 1 MB se acepta", async () => {
      const r = await uploadFile(org.id, { kind: "photo", uploadId: randomUUID(), bytes: jpgOfSize(MB) });
      expect(r.created).toBe(true);
    });
  });

  describe("sin límite", () => {
    it("con maxFileBytes nulo un archivo de 2 MB no se rechaza por plan", async () => {
      await setLimit(null);
      const r = await uploadFile(org.id, { kind: "photo", uploadId: randomUUID(), bytes: jpgOfSize(2 * MB) });
      expect(r.created).toBe(true);
    });
  });
});
