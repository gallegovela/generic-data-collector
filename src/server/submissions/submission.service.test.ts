import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { createOrganization } from "@/server/auth/organization.repository";
import { prisma } from "@/server/db/client";
import {
  buildDailyReportFormVersion,
  DAILY_REPORT_FORM_TITLE,
} from "../../../prisma/fixtures/submissions-dashboard.fixtures";
import { createSubmissionFixture } from "./submission.repository";
import { getHomeStats, getSubmissionDetail, listSubmissions } from "./submission.service";

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
