import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { SUBMISSIONS_PAGE_SIZE } from "@/lib/submissions-dashboard/submission-filters.schema";
import {
  buildDailyReportFormVersion,
  DAILY_REPORT_FORM_TITLE,
} from "../../../prisma/fixtures/submissions-dashboard.fixtures";
import {
  countSubmissionsOfForm,
  createSubmissionFixture,
  findFilterableFields,
  findSubmissionById,
  findSubmissionIdsByText,
  getSubmissionStats,
  listSubmissionsByForm,
  listSubmissionsForExport,
} from "./submission.repository";

// Requiere PostgreSQL accesible vía DATABASE_URL (ver specs/submissions-dashboard/test-plan.md).

const day = 24 * 60 * 60 * 1000;

function make(orgId: string, formId: string, clientId: string, capturedAt: Date, answers: Record<string, unknown> = {}, by?: string) {
  return createSubmissionFixture(orgId, {
    formId,
    formTitle: formId === "form-2" ? "Otro" : DAILY_REPORT_FORM_TITLE,
    clientId,
    formVersionSnapshot: buildDailyReportFormVersion(),
    answers,
    submittedByName: by,
    capturedAt,
  });
}

describe("submission.repository", () => {
  const orgIds: string[] = [];
  let orgA: { id: string };
  let orgB: { id: string };
  let idOfA: string;

  beforeAll(async () => {
    orgA = await createOrganization({ name: "Org A (submission.repository test)" });
    orgB = await createOrganization({ name: "Org B (submission.repository test)" });
    orgIds.push(orgA.id, orgB.id);
    const s = await make(orgA.id, "shared-form", "a-1", new Date(), { site: "Palabraexclusiva", has_incidents: true });
    idOfA = s.id;
  });

  afterAll(async () => {
    await prisma.submission.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  });

  // Cubre: RNF-SUB-03 (PP-SUB-01)
  it("organizacion: ninguna función de lectura cruza organizaciones", async () => {
    expect(await findSubmissionById(orgB.id, idOfA)).toBeNull();
    expect(await listSubmissionsByForm(orgB.id, "shared-form", { page: 1 })).toEqual({ items: [], total: 0 });
    expect(await findFilterableFields(orgB.id, "shared-form")).toEqual([]);
    expect(await getSubmissionStats(orgB.id)).toEqual({ today: 0, thisWeek: 0, byForm: [] });
    expect(await findSubmissionIdsByText(orgB.id, "shared-form", "palabraexclusiva")).toEqual([]);
    expect(
      await listSubmissionsByForm(orgB.id, "shared-form", { page: 1, textQuery: "palabraexclusiva" }),
    ).toEqual({ items: [], total: 0 });
    // y con la organización correcta sí aparece
    expect((await findSubmissionById(orgA.id, idOfA))?.id).toBe(idOfA);
    expect(await findSubmissionIdsByText(orgA.id, "shared-form", "palabraexclusiva")).toEqual([idOfA]);
  });

  // Cubre: RF-SUB-11 (PP-SUB-02)
  it("formVersionSnapshot se guarda sin mutarlo", async () => {
    const snapshot = buildDailyReportFormVersion();
    const expected = JSON.parse(JSON.stringify(snapshot));
    const s = await createSubmissionFixture(orgA.id, {
      formId: "snap-form",
      formTitle: "Snap",
      clientId: "snap-1",
      formVersionSnapshot: snapshot,
      answers: {},
      capturedAt: new Date(),
    });
    snapshot.title = "Cambiado después";
    const stored = await prisma.submission.findUniqueOrThrow({ where: { id: s.id } });
    expect(stored.formVersionSnapshot).toEqual(expected);
  });

  // Cubre: CA-SUB-04, RF-SUB-05 (PP-SUB-03)
  it("CA-SUB-04: pagina de 20 en 20 con 25 respuestas", async () => {
    const base = Date.now() - 10 * day;
    for (let i = 0; i < 25; i++) await make(orgA.id, "page-form", `p-${i}`, new Date(base + i * 1000));
    const p1 = await listSubmissionsByForm(orgA.id, "page-form", { page: 1 });
    const p2 = await listSubmissionsByForm(orgA.id, "page-form", { page: 2 });
    expect(p1.items).toHaveLength(SUBMISSIONS_PAGE_SIZE);
    expect(p1.total).toBe(25);
    expect(p2.items).toHaveLength(5);
    const dates = p1.items.map((i) => i.capturedAt.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  // Cubre: CA-SUB-05, RF-SUB-07 (PP-SUB-06)
  it("CA-SUB-05: búsqueda de texto sin distinguir mayúsculas", async () => {
    await make(orgA.id, "text-form", "t-1", new Date(), { notes: "Se rompió la Grúa torre" });
    await make(orgA.id, "text-form", "t-2", new Date(), { notes: "Todo normal" });
    const r = await listSubmissionsByForm(orgA.id, "text-form", { page: 1, textQuery: "GRÚA" });
    expect(r.total).toBe(1);
    expect(await listSubmissionsByForm(orgA.id, "text-form", { page: 1, textQuery: "inexistente" })).toEqual({
      items: [],
      total: 0,
    });
  });

  it("la búsqueda de texto trata % y _ como texto literal", async () => {
    await make(orgA.id, "like-form", "l-1", new Date(), { notes: "abc" });
    expect(await findSubmissionIdsByText(orgA.id, "like-form", "%")).toEqual([]);
  });

  // Cubre: CA-SUB-06, RF-SUB-10 (PP-SUB-07)
  it("CA-SUB-06: estadísticas de hoy, semana y por formulario", async () => {
    const org = await createOrganization({ name: "Org stats (submission.repository test)" });
    orgIds.push(org.id);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monday = new Date(startOfDay);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const lastWeek = new Date(monday.getTime() - 2 * day);

    await make(org.id, "form-1", "s-1", new Date(startOfDay.getTime() + 1000));
    await make(org.id, "form-1", "s-2", new Date(startOfDay.getTime() + 2000));
    await make(org.id, "form-2", "s-3", new Date(monday.getTime() + 1000)); // esta semana
    await make(org.id, "form-1", "s-4", lastWeek);

    const stats = await getSubmissionStats(org.id);
    const isMonday = startOfDay.getTime() === monday.getTime();
    expect(stats.today).toBe(2 + (isMonday ? 1 : 0));
    expect(stats.thisWeek).toBe(3);
    expect(stats.byForm).toEqual([
      { formId: "form-1", formTitle: DAILY_REPORT_FORM_TITLE, count: 3 },
      { formId: "form-2", formTitle: "Otro", count: 1 },
    ]);
  });

  // Cubre: RF-SUB-06 (PP-SUB-04)
  it("findFilterableFields devuelve los single_choice/yes_no de la respuesta más reciente", async () => {
    const fields = await findFilterableFields(orgA.id, "shared-form");
    expect(fields.map((f) => f.id)).toEqual(["has_incidents"]);
    expect(await findFilterableFields(orgA.id, "no-existe")).toEqual([]);
  });

  // Cubre: RF-OUT-11, CA-OUT-06
  it("CA-OUT-06: las funciones de exportación no cruzan organizaciones", async () => {
    expect(await countSubmissionsOfForm(orgB.id, "shared-form")).toBe(0);
    expect(await listSubmissionsForExport(orgB.id, "shared-form", {}, 100)).toEqual([]);
    expect(await listSubmissionsForExport(orgB.id, "shared-form", { textQuery: "palabraexclusiva" }, 100)).toEqual([]);
    expect(await countSubmissionsOfForm(orgA.id, "shared-form")).toBe(1);
    expect(await listSubmissionsForExport(orgA.id, "shared-form", {}, 100)).toHaveLength(1);
  });

  // Cubre: RF-OUT-11
  it("RF-OUT-11: listSubmissionsForExport ordena por fecha descendente, respeta el límite y guarda la versión", async () => {
    const base = Date.now() - 20 * day;
    for (let i = 0; i < 3; i++) {
      await createSubmissionFixture(orgA.id, {
        formId: "export-form",
        formTitle: "Export",
        clientId: `exp-${i}`,
        formVersionSnapshot: buildDailyReportFormVersion(),
        answers: {},
        formVersionNumber: 7,
        capturedAt: new Date(base + i * 1000),
      });
    }
    const rows = await listSubmissionsForExport(orgA.id, "export-form", {}, 2);
    expect(rows).toHaveLength(2);
    expect(rows[0].capturedAt.getTime()).toBeGreaterThan(rows[1].capturedAt.getTime());
    expect(rows[0].formVersionNumber).toBe(7);
  });
});
