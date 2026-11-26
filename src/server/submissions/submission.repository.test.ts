import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import { SUBMISSIONS_PAGE_SIZE } from "@/lib/submissions-dashboard/submission-filters.schema";
import {
  buildDailyReportFormVersion,
  DAILY_REPORT_FORM_TITLE,
} from "../../../prisma/fixtures/submissions-dashboard.fixtures";
import {
  createSubmissionFixture,
  findFilterableFields,
  findSubmissionById,
  findSubmissionIdsByText,
  getSubmissionStats,
  listFormVersionNumbers,
  listSubmissionsByForm,
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
});

// Cubre: CA-SUB-14 (PP-SUB-18)
describe("CA-SUB-14", () => {
  let orgA: { id: string };
  let orgB: { id: string };

  const add = (orgId: string, clientId: string, version?: number) =>
    createSubmissionFixture(orgId, {
      formId: "ver-form",
      formTitle: DAILY_REPORT_FORM_TITLE,
      clientId,
      formVersionSnapshot: buildDailyReportFormVersion(),
      answers: {},
      capturedAt: new Date(),
      ...(version === undefined ? {} : { formVersionId: `v${version}`, formVersionNumber: version }),
    });

  beforeAll(async () => {
    orgA = await createOrganization({ name: "Org A (CA-SUB-14 test)" });
    orgB = await createOrganization({ name: "Org B (CA-SUB-14 test)" });
    await add(orgA.id, "v-1", 1);
    await add(orgA.id, "v-2", 2);
    await add(orgA.id, "v-3", 2);
    await add(orgA.id, "v-null");
    await add(orgB.id, "v-b", 7);
  });

  afterAll(async () => {
    await prisma.submission.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  });

  it("filtra el listado por formVersionNumber y devuelve la versión de cada fila", async () => {
    const v2 = await listSubmissionsByForm(orgA.id, "ver-form", { page: 1, formVersionNumber: 2 });
    expect(v2.total).toBe(2);
    expect(v2.items.every((i) => i.formVersionNumber === 2)).toBe(true);
    const all = await listSubmissionsByForm(orgA.id, "ver-form", { page: 1 });
    expect(all.total).toBe(4);
    expect(all.items.some((i) => i.formVersionNumber === null)).toBe(true);
  });

  it("listFormVersionNumbers devuelve [1, 2] sin NULL ni versiones de otra organización", async () => {
    expect(await listFormVersionNumbers(orgA.id, "ver-form")).toEqual([1, 2]);
  });
});
