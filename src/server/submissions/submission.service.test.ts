import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// RF-OUT-13: espía que delega en la implementación real salvo que un test la cambie.
const scheduleDeliveries = vi.hoisted(() => vi.fn());
vi.mock("@/server/outputs/delivery.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/outputs/delivery.service")>();
  scheduleDeliveries.mockImplementation(actual.scheduleDeliveries);
  return { ...actual, scheduleDeliveries };
});
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { FormVersion } from "@/lib/form-schema";
import type { CreateSubmissionInput } from "@/lib/submissions-dashboard/create-submission.schema";
import { SubmissionValidationError } from "@/lib/submissions-dashboard/submission-errors";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import {
  buildDailyReportFormVersion,
  DAILY_REPORT_FORM_TITLE,
} from "../../../prisma/fixtures/submissions-dashboard.fixtures";
import { createSubmissionFixture } from "./submission.repository";
import { createSubmission, getHomeStats, getSubmissionDetail, listSubmissions } from "./submission.service";

// Requiere PostgreSQL accesible vía DATABASE_URL.

const FORM = "svc-form";

describe("submission.service", () => {
  let org: { id: string };
  let otherOrg: { id: string };

  const add = (clientId: string, capturedAt: string, hasIncidents: boolean, by: string) =>
    createSubmissionFixture(org.id, {
      formId: FORM,
      formTitle: DAILY_REPORT_FORM_TITLE,
      clientId,
      formVersionSnapshot: buildDailyReportFormVersion(),
      answers: { site: "X", has_incidents: hasIncidents },
      submittedByName: by,
      capturedAt: new Date(capturedAt),
    });

  beforeAll(async () => {
    org = await createOrganization({ name: "Org (submission.service test)" });
    otherOrg = await createOrganization({ name: "Otra org (submission.service test)" });
    await add("1", "2026-03-10T10:00:00", true, "Ana");
    await add("2", "2026-03-10T11:00:00", false, "Luis");
    await add("3", "2026-03-20T10:00:00", true, "Ana");
    await add("4", "2026-03-20T12:00:00", true, "Luis");
  });

  afterAll(async () => {
    await prisma.submission.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [org.id, otherOrg.id] } } });
  });

  // Cubre: CA-SUB-02 (PP-SUB-04)
  it("CA-SUB-02: filtra por el campo sí/no", async () => {
    const yes = await listSubmissions(org.id, FORM, { page: 1, fieldId: "has_incidents", fieldValue: "true" });
    const no = await listSubmissions(org.id, FORM, { page: 1, fieldId: "has_incidents", fieldValue: "false" });
    expect(yes.total).toBe(3);
    expect(no.total).toBe(1);
    expect(yes.filterableFields.map((f) => f.id)).toEqual(["has_incidents"]);
  });

  it("ignora un filtro de campo que no existe", async () => {
    const r = await listSubmissions(org.id, FORM, { page: 1, fieldId: "borrado", fieldValue: "true" });
    expect(r.total).toBe(4);
  });

  // Cubre: CA-SUB-08 (PP-SUB-05)
  it("CA-SUB-08: combina rango de fechas y usuario", async () => {
    const r = await listSubmissions(org.id, FORM, {
      page: 1,
      dateFrom: "2026-03-20",
      dateTo: "2026-03-20",
      submittedBy: "ana",
    });
    expect(r.total).toBe(1);
    const onlyDate = await listSubmissions(org.id, FORM, { page: 1, dateFrom: "2026-03-20", dateTo: "2026-03-20" });
    expect(onlyDate.total).toBe(2);
    const onlyUser = await listSubmissions(org.id, FORM, { page: 1, submittedBy: "ana" });
    expect(onlyUser.total).toBe(2);
  });

  it("getSubmissionDetail lanza NotFoundError si no existe en esa organización", async () => {
    const { items } = await listSubmissions(org.id, FORM, { page: 1 });
    expect((await getSubmissionDetail(org.id, items[0].id)).id).toBe(items[0].id);
    await expect(getSubmissionDetail(otherOrg.id, items[0].id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("getHomeStats delega en las estadísticas de la organización", async () => {
    expect((await getHomeStats(otherOrg.id)).byForm).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Recepción de respuestas (#27). Requiere PostgreSQL.
// ---------------------------------------------------------------------------

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("createSubmission", () => {
  let org: { id: string };
  let otherOrg: { id: string };
  let seq = 1;

  const v1 = (): FormVersion => buildDailyReportFormVersion();
  const v2 = (): FormVersion => ({
    ...buildDailyReportFormVersion(),
    fields: [
      ...buildDailyReportFormVersion().fields,
      { id: "supervisor", type: "text", label: "Supervisor", required: true, config: {} },
    ],
  });
  const hiddenPhotos = (): FormVersion => ({
    schemaVersion: 1,
    title: "Con campo oculto",
    fields: [
      { id: "has_photos", type: "yes_no", label: "¿Hay fotos?", required: true, config: {} },
      {
        id: "photos",
        type: "photo",
        label: "Fotos",
        required: false,
        config: { maxPhotos: 5 },
        visibleIf: { fieldId: "has_photos", operator: "equals", value: true },
      },
    ],
  });

  const key = (orgId: string, kind = "photo") => `org/${orgId}/${kind}/${UUID(seq++)}.jpg`;

  const input = (over: Partial<CreateSubmissionInput> & { schema?: FormVersion; versionNumber?: number } = {}): CreateSubmissionInput => {
    const { schema, versionNumber, ...rest } = over;
    return {
      organizationId: org.id,
      actor: { kind: "anonymous" },
      form: {
        id: "create-form",
        title: DAILY_REPORT_FORM_TITLE,
        versionId: `ver-${versionNumber ?? 1}`,
        versionNumber: versionNumber ?? 1,
        schema: schema ?? v1(),
      },
      clientId: UUID(seq++),
      answers: { site: "Obra 1", has_incidents: false },
      capturedAt: new Date("2026-03-10T10:00:00Z"),
      ...rest,
    };
  };

  const count = (organizationId = org.id) => prisma.submission.count({ where: { organizationId } });

  beforeAll(async () => {
    org = await createOrganization({ name: "Org (createSubmission test)" });
    otherOrg = await createOrganization({ name: "Otra org (createSubmission test)" });
  });

  afterAll(async () => {
    await prisma.submission.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [org.id, otherOrg.id] } } });
  });

  describe("CA-SUB-10", () => {
    // Cubre: CA-SUB-10 (PP-SUB-13)
    it("el mismo clientId dos veces deja una sola fila", async () => {
      const i = input();
      const first = await createSubmission(i);
      const second = await createSubmission(i);
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.submission.id).toBe(first.submission.id);
      expect(await prisma.submission.count({ where: { organizationId: org.id, clientId: i.clientId } })).toBe(1);
    });

    it("el mismo clientId con otro formulario lanza ConflictError", async () => {
      const i = input();
      await createSubmission(i);
      await expect(createSubmission({ ...i, form: { ...i.form, id: "otro-form" } })).rejects.toBeInstanceOf(
        ConflictError,
      );
    });

    it("dos envíos simultáneos dejan una sola fila", async () => {
      const i = input();
      const [a, b] = await Promise.all([createSubmission(i), createSubmission(i)]);
      expect(a.submission.id).toBe(b.submission.id);
      expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
      expect(await prisma.submission.count({ where: { organizationId: org.id, clientId: i.clientId } })).toBe(1);
    });
  });

  describe("RF-OUT-13", () => {
    // Cubre: RF-OUT-13
    it("RF-OUT-13: solo dispara los envíos cuando se inserta de verdad (created:true)", async () => {
      scheduleDeliveries.mockClear();
      const i = input();
      const first = await createSubmission(i);
      expect(first.created).toBe(true);
      expect(scheduleDeliveries).toHaveBeenCalledTimes(1);
      expect(scheduleDeliveries.mock.calls[0][0]).toBe(org.id);
      const second = await createSubmission(i);
      expect(second.created).toBe(false);
      expect(scheduleDeliveries).toHaveBeenCalledTimes(1);
    });

    it("RF-OUT-13: si scheduleDeliveries rechaza, la respuesta se guarda igualmente", async () => {
      scheduleDeliveries.mockRejectedValueOnce(new Error("boom"));
      const i = input();
      const result = await createSubmission(i);
      expect(result.created).toBe(true);
      expect(await prisma.submission.count({ where: { organizationId: org.id, clientId: i.clientId } })).toBe(1);
    });
  });

  describe("CA-SUB-11", () => {
    // Cubre: CA-SUB-11 (PP-SUB-14)
    it("rechaza un obligatorio ausente señalando el campo y no guarda", async () => {
      const before = await count();
      const err = await createSubmission(input({ answers: { has_incidents: false, notes: "SECRETO-123" } })).catch(
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(SubmissionValidationError);
      const fieldErrors = (err as SubmissionValidationError).fieldErrors;
      expect(fieldErrors.map((f) => f.fieldId)).toContain("site");
      expect(JSON.stringify(fieldErrors)).not.toContain("SECRETO-123");
      expect(await count()).toBe(before);
    });
  });

  describe("CA-SUB-12", () => {
    // Cubre: CA-SUB-12 (PP-SUB-15)
    it("acepta una respuesta de v1 aunque v2 tenga un obligatorio nuevo", async () => {
      const r = await createSubmission(input({ schema: v1(), versionNumber: 1 }));
      expect(r.submission.formVersionNumber).toBe(1);
      expect(r.submission.formVersionSnapshot).toEqual(v1());
      // La misma respuesta contra v2 sí falla.
      await expect(createSubmission(input({ schema: v2(), versionNumber: 2 }))).rejects.toBeInstanceOf(
        SubmissionValidationError,
      );
    });
  });

  describe("CA-SUB-13", () => {
    // Cubre: CA-SUB-13 (PP-SUB-16)
    it("un usuario de A no guarda en B", async () => {
      const before = await count(otherOrg.id);
      await expect(
        createSubmission(
          input({
            organizationId: otherOrg.id,
            actor: { kind: "user", userId: "u1", userName: "Ana", userOrganizationId: org.id },
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(await count(otherOrg.id)).toBe(before);
    });
  });

  describe("limites", () => {
    // Cubre: RF-SUB-01, RF-SUB-03 (PP-SUB-17)
    const photoSchema = (): FormVersion => ({
      schemaVersion: 1,
      title: "Fotos",
      fields: [
        { id: "photos", type: "photo", label: "Fotos", required: false, config: { maxPhotos: 5 } },
        { id: "sig", type: "signature", label: "Firma", required: false, config: {} },
      ],
    });

    it("rechaza answers de más de 256 KiB", async () => {
      const err = await createSubmission(
        input({ schema: v1(), answers: { site: "x".repeat(300 * 1024), has_incidents: false } }),
      ).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SubmissionValidationError);
      expect((err as SubmissionValidationError).fieldErrors[0]).toEqual({
        fieldId: "_",
        message: "La respuesta es demasiado grande.",
      });
    });

    it("rechaza una clave ajena entre otras propias en photo", async () => {
      const err = await createSubmission(
        input({
          schema: photoSchema(),
          answers: {
            photos: [{ key: key(org.id) }, { key: key(otherOrg.id) }, { key: key(org.id) }],
          },
        }),
      ).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SubmissionValidationError);
      expect((err as SubmissionValidationError).fieldErrors).toEqual([
        { fieldId: "photos", message: "Archivo no válido." },
      ]);
    });

    it("rechaza una firma ajena", async () => {
      const err = await createSubmission(
        input({ schema: photoSchema(), answers: { sig: { key: key(otherOrg.id, "signature") } } }),
      ).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SubmissionValidationError);
      expect((err as SubmissionValidationError).fieldErrors[0].fieldId).toBe("sig");
    });

    it("rechaza una clave con '..'", async () => {
      await expect(
        createSubmission(
          input({ schema: photoSchema(), answers: { photos: [{ key: `org/${org.id}/../${otherOrg.id}/photo/x.jpg` }] } }),
        ),
      ).rejects.toBeInstanceOf(SubmissionValidationError);
    });

    it("acepta fotos y firma propias", async () => {
      const r = await createSubmission(
        input({
          schema: photoSchema(),
          answers: { photos: [{ key: key(org.id) }, { key: key(org.id) }], sig: { key: key(org.id, "signature") } },
        }),
      );
      expect(r.created).toBe(true);
    });

    it("no comprueba una clave ajena en un campo oculto por lógica condicional", async () => {
      const r = await createSubmission(
        input({
          schema: hiddenPhotos(),
          answers: { has_photos: false, photos: [{ key: key(otherOrg.id) }] },
        }),
      );
      expect(r.created).toBe(true);
      expect(r.submission.answers).toEqual({ has_photos: false });
    });
  });

  describe("autor", () => {
    // Cubre: RF-SUB-01 (PP-SUB-17)
    it("el actor user guarda su id y nombre", async () => {
      const r = await createSubmission(
        input({ actor: { kind: "user", userId: "user-1", userName: "Ana", userOrganizationId: org.id } }),
      );
      expect(r.submission.submittedByUserId).toBe("user-1");
      expect(r.submission.submittedByName).toBe("Ana");
    });

    it("el anónimo guarda null en ambos", async () => {
      const r = await createSubmission(input());
      expect(r.submission.submittedByUserId).toBeNull();
      expect(r.submission.submittedByName).toBeNull();
    });
  });

  describe("fechas", () => {
    // Cubre: RF-SUB-04 (PP-SUB-17)
    it("guarda capturedAt tal cual y syncedAt lo pone el servidor", async () => {
      const capturedAt = new Date("2026-01-02T03:04:05Z");
      const before = Date.now();
      const r = await createSubmission(input({ capturedAt }));
      expect(r.submission.capturedAt.toISOString()).toBe(capturedAt.toISOString());
      expect(r.submission.syncedAt.getTime()).toBeGreaterThanOrEqual(before - 5000);
    });
  });

  it("listSubmissions devuelve las versiones y filtra por ellas", async () => {
    await createSubmission(input({ schema: v2(), versionNumber: 2, answers: { site: "S", has_incidents: false, supervisor: "P" } }));
    const all = await listSubmissions(org.id, "create-form", { page: 1 });
    expect(all.versions).toEqual([1, 2]);
    const only2 = await listSubmissions(org.id, "create-form", { page: 1, version: 2 });
    expect(only2.items.every((i) => i.formVersionNumber === 2)).toBe(true);
    expect((await listSubmissions(org.id, "create-form", { page: 1, version: 99 })).total).toBe(0);
  });
});
