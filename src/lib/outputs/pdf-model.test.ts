import type { Submission } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildDailyReportFormVersion,
} from "../../../prisma/fixtures/submissions-dashboard.fixtures";
import { buildPdfModel, resolvePdfTheme } from "./pdf-model";

const ORG = "org1";

function sub(over: Partial<Submission> = {}): Submission {
  return {
    id: "sub1",
    organizationId: ORG,
    formId: "f1",
    formTitle: "Parte diario de obra",
    clientId: "c1",
    formVersionSnapshot: buildDailyReportFormVersion(),
    answers: {
      site: "Obra 1",
      has_incidents: true,
      photos: [{ key: `org/${ORG}/photo/a.jpg` }, { key: `org/${ORG}/photo/b.jpg` }],
      location: { lat: 40.4, lng: -3.7, accuracy: 5, capturedAt: "2026-01-01T10:00:00.000Z" },
      foreman_signature: { key: `org/${ORG}/signature/s.png` },
    },
    submittedByName: "Ana",
    formVersionId: "v2",
    formVersionNumber: 2,
    submittedByUserId: null,
    capturedAt: new Date("2026-11-26T09:30:00Z"),
    syncedAt: new Date("2026-11-26T09:31:00Z"),
    createdAt: new Date(),
    ...over,
  } as Submission;
}

describe("pdf-model", () => {
  // Cubre: RF-OUT-03, CA-OUT-12
  it("RF-OUT-03: respeta el orden, omite ocultos y muestra secciones, sí/no y GPS", () => {
    const model = buildPdfModel({ organizationName: "Acme", submission: sub(), baseUrl: "https://app.test/" });
    expect(model.entries.map((e) => e.label)).toEqual([
      "Datos de la obra",
      "Obra",
      "¿Hay incidencias?",
      "Fotos de la obra",
      "Ubicación",
      "Firma del encargado",
    ]);
    expect(model.entries[0].kind).toBe("section");
    expect(model.entries[2]).toMatchObject({ kind: "text", value: "Sí" });
    expect(model.entries[4]).toMatchObject({ kind: "text", value: "40.4, -3.7" });
    expect(model.entries[3]).toMatchObject({ kind: "images", omitted: 0 });
    expect(model.versionLabel).toBe("Versión 2");
    expect(model.capturedAt).toBe("26/11/2026 10:30");
    expect(model.viewUrl).toBe("https://app.test/admin/forms/f1/submissions/sub1");
  });

  it("RF-OUT-03: sin versión numerada, 'Versión desconocida'", () => {
    const model = buildPdfModel({
      organizationName: "A",
      submission: sub({ formVersionNumber: null }),
      baseUrl: "https://app.test",
    });
    expect(model.versionLabel).toBe("Versión desconocida");
  });

  it("RF-OUT-17: limita a 12 imágenes y cuenta las omitidas", () => {
    const photos = Array.from({ length: 15 }, (_, i) => ({ key: `org/${ORG}/photo/${i}.jpg` }));
    const model = buildPdfModel({
      organizationName: "A",
      submission: sub({ answers: { site: "x", has_incidents: false, photos } }),
      baseUrl: "https://app.test",
    });
    const entry = model.entries.find((e) => e.label === "Fotos de la obra");
    expect(entry).toMatchObject({ kind: "images", omitted: 3 });
    expect(entry?.kind === "images" && entry.images).toHaveLength(12);
  });

  it("RF-OUT-03: tema por defecto, logo propio y logo ajeno descartado", () => {
    expect(resolvePdfTheme({}, ORG)).toEqual({
      primaryColor: "#1f2937",
      secondaryColor: "#6b7280",
      logo: null,
    });
    const own = resolvePdfTheme(
      { theme: { primaryColor: "#112233", secondaryColor: "malo", logoKey: `org/${ORG}/logo/l.png` } },
      ORG,
    );
    expect(own).toEqual({ primaryColor: "#112233", secondaryColor: "#6b7280", logo: { key: `org/${ORG}/logo/l.png` } });
    expect(resolvePdfTheme({ theme: { logoKey: "org/otra/logo/l.png" } }, ORG).logo).toBeNull();
  });

  it("RF-OUT-03: un snapshot inválido lista las claves de answers como texto", () => {
    const model = buildPdfModel({
      organizationName: "A",
      submission: sub({ formVersionSnapshot: { roto: true }, answers: { a: "uno", b: 2 } }),
      baseUrl: "https://app.test",
    });
    expect(model.entries).toEqual([
      { kind: "text", label: "a", value: "uno" },
      { kind: "text", label: "b", value: "2" },
    ]);
  });
});
