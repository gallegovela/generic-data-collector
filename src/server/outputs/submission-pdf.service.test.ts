import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { InMemoryStorageAdapter } from "@/server/storage/in-memory-storage-adapter";
import { setStorageAdapterForTests } from "@/server/storage/storage-adapter";
import { createSubmissionFixture } from "@/server/submissions/submission.repository";
import {
  buildNoisePng,
  createFormFixture,
  createSubmissionWithTheme,
  deleteOutputsData,
} from "../../../prisma/fixtures/outputs.fixtures";
import { generateSubmissionPdf, getSubmissionPdfForDownload, MAX_IMAGE_READ_BYTES } from "./submission-pdf.service";

// Requiere PostgreSQL accesible vía DATABASE_URL; el almacenamiento es en memoria.

const BASE = "https://app.test";
const countImages = (buffer: Buffer) => (buffer.toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length;

describe("submission-pdf.service", () => {
  const adapter = new InMemoryStorageAdapter();
  let orgA: { id: string };
  let orgB: { id: string };
  let formId: string;

  async function seedFile(
    kind: "photo" | "signature",
    bytes: Uint8Array,
    contentType: string,
    sizeBytes = bytes.byteLength,
  ): Promise<string> {
    const id = randomUUID();
    const key = `org/${orgA.id}/${kind}/${id}.bin`;
    await adapter.put({ key, body: bytes, contentType });
    await prisma.storedFile.create({
      data: { organizationId: orgA.id, key, uploadId: id, kind, contentType, sizeBytes },
    });
    return key;
  }

  async function submission(over: { logoKey?: string; photos?: string[]; signature?: string }) {
    return createSubmissionFixture(orgA.id, {
      formId,
      formTitle: "Parte diario de obra",
      clientId: randomUUID(),
      formVersionSnapshot: createSubmissionWithTheme(over.logoKey),
      answers: {
        site: "Obra 1",
        has_incidents: false,
        ...(over.photos ? { photos: over.photos.map((key) => ({ key })) } : {}),
        ...(over.signature ? { foreman_signature: { key: over.signature } } : {}),
      },
      submittedByName: "Ana",
      capturedAt: new Date(),
    });
  }

  beforeAll(async () => {
    setStorageAdapterForTests(adapter);
    orgA = await createOrganization({ name: "Org A (submission-pdf test)" });
    orgB = await createOrganization({ name: "Org B (submission-pdf test)" });
    formId = (await createFormFixture(orgA.id)).id;
  });

  afterAll(async () => {
    setStorageAdapterForTests(null);
    await deleteOutputsData([orgA.id, orgB.id]);
  });

  // Cubre: CA-OUT-12, CA-OUT-13
  it("CA-OUT-12: el PDF empieza por %PDF- e incrusta logo y firma (2 imágenes)", async () => {
    const png = buildNoisePng(8, 8);
    const logo = await seedFile("photo", png, "image/png");
    const signature = await seedFile("signature", png, "image/png");
    const { buffer, imagesIncluded } = await generateSubmissionPdf(await submission({ logoKey: logo, signature }), BASE);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(imagesIncluded).toBe(true);
    expect(countImages(buffer)).toBe(2);
  });

  it("CA-OUT-13: una imagen WEBP se sustituye sin lanzar", async () => {
    const webp = await seedFile("photo", new Uint8Array([1, 2, 3]), "image/webp");
    const { buffer } = await generateSubmissionPdf(await submission({ photos: [webp] }), BASE);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(countImages(buffer)).toBe(0);
  });

  it("CA-OUT-13: una imagen de más de 5 MB (MAX_IMAGE_READ_BYTES) o inexistente se sustituye sin lanzar", async () => {
    const big = await seedFile("photo", buildNoisePng(8, 8), "image/png", MAX_IMAGE_READ_BYTES + 1);
    const missing = `org/${orgA.id}/photo/${randomUUID()}.png`;
    const { buffer } = await generateSubmissionPdf(await submission({ photos: [big, missing] }), BASE);
    expect(countImages(buffer)).toBe(0);
  });

  it("CA-OUT-13: con maxBytes pequeño se regenera sin imágenes y con aviso", async () => {
    const photo = await seedFile("photo", buildNoisePng(200, 200), "image/png");
    const sub = await submission({ photos: [photo] });
    const withImages = await generateSubmissionPdf(sub, BASE);
    expect(withImages.imagesIncluded).toBe(true);
    expect(countImages(withImages.buffer)).toBe(1);

    const limited = await generateSubmissionPdf(sub, BASE, { maxBytes: 60_000 });
    expect(limited.imagesIncluded).toBe(false);
    expect(countImages(limited.buffer)).toBe(0);
    expect(limited.buffer.length).toBeLessThanOrEqual(60_000);

    await expect(generateSubmissionPdf(sub, BASE, { maxBytes: 100 })).rejects.toThrow("PDF_TOO_LARGE");
  });

  it("CA-OUT-09: getSubmissionPdfForDownload con otra organización lanza NotFoundError", async () => {
    const sub = await submission({});
    const ok = await getSubmissionPdfForDownload(orgA.id, formId, sub.id, BASE);
    expect(ok.filename).toMatch(/^parte-diario-de-obra-\d{8}-[a-z0-9]{8}\.pdf$/);
    await expect(getSubmissionPdfForDownload(orgB.id, formId, sub.id, BASE)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getSubmissionPdfForDownload(orgA.id, "otro-form", sub.id, BASE)).rejects.toBeInstanceOf(NotFoundError);
  });
});
