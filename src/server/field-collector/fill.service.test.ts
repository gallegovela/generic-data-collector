import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import type { DraftForm } from "@/lib/form-editor/form-editor.schema";
import type { FillSubmissionBody } from "@/lib/field-collector/fill.schema";
import { SubmissionValidationError } from "@/lib/submissions-dashboard/submission-errors";
import { createOrganization } from "@/server/auth/organization.repository";
import type { CurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { createForm, saveDraft } from "@/server/forms/form.service";
import {
  getPublishedFormBySlug,
  publishForm,
  unpublishForm,
} from "@/server/form-publishing/form-publishing.service";
import { InMemoryStorageAdapter } from "@/server/storage/in-memory-storage-adapter";
import { setStorageAdapterForTests } from "@/server/storage/storage-adapter";
import { FormClosedError, submitFill, uploadFillFile } from "./fill.service";

// Requiere PostgreSQL accesible vía DATABASE_URL (npm run test:stack:run -- npm test).

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

const draft: DraftForm = {
  title: "Parte",
  fields: [
    { id: "note", type: "text", label: "Nota", required: true, config: {} },
    { id: "photos", type: "photo", label: "Fotos", required: false, config: { maxPhotos: 3 } },
    { id: "sign", type: "signature", label: "Firma", required: false, config: {} },
  ],
};

describe("fill.service", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let userA: CurrentUser;
  let userB: CurrentUser;
  let adapter: InMemoryStorageAdapter;

  const mkUser = (orgId: string, name: string): CurrentUser => ({
    id: `user-${randomUUID()}`,
    organizationId: orgId,
    email: `${randomUUID()}@example.test`,
    name,
    role: "collector",
  });

  async function publish(accessMode: "registered" | "public", d: DraftForm = draft) {
    const form = await createForm(orgA.id, { name: "Fill test" });
    await saveDraft(orgA.id, form.id, { draft: d });
    const result = await publishForm(orgA.id, "u", form.id, { accessMode });
    const lookup = await getPublishedFormBySlug(result.slug);
    if (lookup.state !== "published") throw new Error("esperaba published");
    return { formId: form.id, slug: result.slug, versionId: lookup.form.versionId };
  }

  const body = (versionId: string, answers: Record<string, unknown>, extra = {}): FillSubmissionBody => ({
    clientId: randomUUID(),
    versionId,
    capturedAt: new Date().toISOString(),
    answers,
    ...extra,
  });

  beforeAll(async () => {
    orgA = await createOrganization({ name: "Org A (fill.service test)" });
    orgB = await createOrganization({ name: "Org B (fill.service test)" });
    userA = mkUser(orgA.id, "Ana");
    userB = mkUser(orgB.id, "Beto");
  });

  beforeEach(() => {
    adapter = new InMemoryStorageAdapter();
    setStorageAdapterForTests(adapter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    setStorageAdapterForTests(null);
    const ids = [orgA.id, orgB.id];
    await prisma.storedFile.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.submission.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.formVersion.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.form.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
  });

  // Cubre: CA-COL-02
  it("CA-COL-02: dos submitFill con el mismo clientId dan una sola Submission", async () => {
    const f = await publish("registered");
    const b = body(f.versionId, { note: "hola" });
    const first = await submitFill(f.slug, userA, b);
    const second = await submitFill(f.slug, userA, b);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);
    expect(await prisma.submission.count({ where: { formId: f.formId } })).toBe(1);
  });

  // Cubre: CA-COL-04
  it("CA-COL-04: guarda con la versión publicada, solo claves y enlaza los archivos", async () => {
    const f = await publish("registered");
    const photo = await uploadFillFile(f.slug, userA, { kind: "photo", uploadId: randomUUID(), bytes: JPG });
    const sign = await uploadFillFile(f.slug, userA, { kind: "signature", uploadId: randomUUID(), bytes: PNG });
    const result = await submitFill(
      f.slug,
      userA,
      body(f.versionId, { note: "x", photos: [{ key: photo.file.key }], sign: { key: sign.file.key } }),
    );

    const sub = await prisma.submission.findUniqueOrThrow({ where: { id: result.id } });
    expect(sub.formVersionId).toBe(f.versionId);
    expect(sub.capturedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(sub.answers)).not.toMatch(/https?:/);
    expect(sub.submittedByUserId).toBe(userA.id);
    const files = await prisma.storedFile.findMany({ where: { key: { in: [photo.file.key, sign.file.key] } } });
    expect(files).toHaveLength(2);
    expect(files.every((s) => s.submissionId === result.id)).toBe(true);
  });

  // Cubre: CA-COL-06
  it("CA-COL-06: registered sin sesión da 401 y con otra organización 403, sin crear nada", async () => {
    const f = await publish("registered");
    const b = body(f.versionId, { note: "x" });
    await expect(submitFill(f.slug, null, b)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(submitFill(f.slug, userB, b)).rejects.toBeInstanceOf(ForbiddenError);
    const up = { kind: "photo" as const, uploadId: randomUUID(), bytes: JPG };
    await expect(uploadFillFile(f.slug, null, up)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(uploadFillFile(f.slug, userB, up)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.submission.count({ where: { formId: f.formId } })).toBe(0);
    expect(await prisma.storedFile.count({ where: { uploadId: up.uploadId } })).toBe(0);
  });

  // Cubre: CA-COL-07
  it("CA-COL-07: anónimo en public guarda en la organización del formulario", async () => {
    const f = await publish("public");
    const photo = await uploadFillFile(f.slug, null, { kind: "photo", uploadId: randomUUID(), bytes: JPG });
    const result = await submitFill(
      f.slug,
      null,
      body(f.versionId, { note: "x", photos: [{ key: photo.file.key }] }),
    );
    const sub = await prisma.submission.findUniqueOrThrow({ where: { id: result.id } });
    expect(sub.organizationId).toBe(orgA.id);
    expect(sub.submittedByUserId).toBeNull();
    expect(sub.submittedByName).toBeNull();
  });

  // Cubre: CA-COL-07
  it("CA-COL-07: una clave de otra organización se rechaza y nada se escribe en B", async () => {
    const f = await publish("public");
    const fileOfB = await prisma.storedFile.create({
      data: {
        organizationId: orgB.id,
        key: `org/${orgB.id}/photo/${randomUUID()}.jpg`,
        uploadId: randomUUID(),
        kind: "photo",
        contentType: "image/jpeg",
        sizeBytes: 8,
      },
    });
    await expect(
      submitFill(f.slug, null, body(f.versionId, { note: "x", photos: [{ key: fileOfB.key }] })),
    ).rejects.toBeInstanceOf(SubmissionValidationError);
    // organizationId en el cuerpo se ignora: el esquema del cuerpo no lo contempla.
    const result = await submitFill(
      f.slug,
      null,
      body(f.versionId, { note: "x" }, { organizationId: orgB.id }),
    );
    const sub = await prisma.submission.findUniqueOrThrow({ where: { id: result.id } });
    expect(sub.organizationId).toBe(orgA.id);
    expect(await prisma.submission.count({ where: { organizationId: orgB.id } })).toBe(0);
    expect((await prisma.storedFile.findUniqueOrThrow({ where: { id: fileOfB.id } })).submissionId).toBeNull();
  });

  // Cubre: CA-COL-07
  it("CA-COL-07: el mismo uploadId en otra organización no pisa el archivo", async () => {
    const f = await publish("public");
    const uploadId = randomUUID();
    const a = await uploadFillFile(f.slug, null, { kind: "photo", uploadId, bytes: JPG });
    expect(a.file.key).toContain(`org/${orgA.id}/`);
    const { uploadFile } = await import("@/server/storage/storage.service");
    const b = await uploadFile(orgB.id, { kind: "photo", uploadId, bytes: JPG });
    expect(b.created).toBe(true);
    expect(b.file.key).not.toBe(a.file.key);
    expect(await prisma.storedFile.count({ where: { uploadId } })).toBe(2);
  });

  // Cubre: CA-COL-07
  it("CA-COL-07: una clave ya enlazada a otra Submission no se reasigna", async () => {
    const f = await publish("public");
    const photo = await uploadFillFile(f.slug, null, { kind: "photo", uploadId: randomUUID(), bytes: JPG });
    const first = await submitFill(
      f.slug,
      null,
      body(f.versionId, { note: "1", photos: [{ key: photo.file.key }] }),
    );
    const second = await submitFill(
      f.slug,
      null,
      body(f.versionId, { note: "2", photos: [{ key: photo.file.key }] }),
    );
    expect(second.id).not.toBe(first.id);
    const stored = await prisma.storedFile.findUniqueOrThrow({ where: { key: photo.file.key } });
    expect(stored.submissionId).toBe(first.id);
  });

  // Cubre: CA-COL-08
  it("CA-COL-08: despublicado, subida y guardado dan FormClosedError y no crean nada", async () => {
    const f = await publish("public");
    await unpublishForm(orgA.id, f.formId);
    await expect(submitFill(f.slug, null, body(f.versionId, { note: "x" }))).rejects.toBeInstanceOf(
      FormClosedError,
    );
    const up = { kind: "photo" as const, uploadId: randomUUID(), bytes: JPG };
    await expect(uploadFillFile(f.slug, null, up)).rejects.toBeInstanceOf(FormClosedError);
    expect(await prisma.submission.count({ where: { formId: f.formId } })).toBe(0);
    expect(await prisma.storedFile.count({ where: { uploadId: up.uploadId } })).toBe(0);
  });

  // Cubre: CA-COL-08
  it("CA-COL-08: rellenada con v1 mientras se publica v2 se guarda con v1", async () => {
    const f = await publish("public");
    await saveDraft(orgA.id, f.formId, {
      draft: {
        title: "Parte v2",
        fields: [{ id: "other", type: "text", label: "Otro", required: true, config: {} }],
      },
    });
    await publishForm(orgA.id, "u", f.formId, { accessMode: "public" });
    const result = await submitFill(f.slug, null, body(f.versionId, { note: "con v1" }));
    const sub = await prisma.submission.findUniqueOrThrow({ where: { id: result.id } });
    expect(sub.formVersionNumber).toBe(1);
    expect(sub.formVersionId).toBe(f.versionId);
  });

  it("rechaza una versión que no es del formulario", async () => {
    const f = await publish("public");
    const other = await publish("public");
    await expect(submitFill(f.slug, null, body(other.versionId, { note: "x" }))).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(submitFill(f.slug, null, body("no-existe", { note: "x" }))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  // Cubre: CA-COL-10
  it("CA-COL-10: honeypot relleno no crea Submission ni enlaza archivos", async () => {
    const f = await publish("public");
    const photo = await uploadFillFile(f.slug, null, { kind: "photo", uploadId: randomUUID(), bytes: JPG });
    const result = await submitFill(
      f.slug,
      null,
      body(f.versionId, { note: "x", photos: [{ key: photo.file.key }] }, { website: "http://spam" }),
    );
    expect(result).toEqual({ id: "", created: false });
    expect(await prisma.submission.count({ where: { formId: f.formId } })).toBe(0);
    expect((await prisma.storedFile.findUniqueOrThrow({ where: { key: photo.file.key } })).submissionId).toBeNull();
  });

  // Cubre: CA-COL-10, RNF-COL-05
  it("CA-COL-10: los logs no incluyen respuestas ni IP", async () => {
    const f = await publish("public");
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const secret = "valor-secreto-de-la-respuesta";
    await submitFill(f.slug, null, body(f.versionId, { note: secret }));
    const logged = spies.flatMap((s) => s.mock.calls).map((c) => JSON.stringify(c)).join("\n");
    expect(logged).toContain("fill.submitted");
    expect(logged).not.toContain(secret);
    expect(logged).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });
});
