import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";

const getPdf = vi.fn();
const requireSession = vi.fn();

vi.mock("@/server/outputs/submission-pdf.service", () => ({
  getSubmissionPdfForDownload: (...args: unknown[]) => getPdf(...args),
}));
vi.mock("@/server/auth/session", () => ({
  requireSession: (...args: unknown[]) => requireSession(...args),
}));

const request = () => new NextRequest("http://interno:3000/api/forms/f1/submissions/s1/pdf");
const ctx = { params: Promise.resolve({ id: "f1", submissionId: "s1" }) };

describe("GET /api/forms/[id]/submissions/[submissionId]/pdf", () => {
  beforeEach(() => {
    requireSession.mockResolvedValue({ organizationId: "org-1", role: "admin" });
    getPdf.mockResolvedValue({ filename: "parte-20260101-abcd1234.pdf", buffer: Buffer.from("%PDF-1.4") });
    delete process.env.AUTH_URL;
  });
  afterEach(() => vi.resetAllMocks());

  // Cubre: CA-OUT-12
  it("CA-OUT-12: 200 con cabeceras de descarga y organización de la sesión", async () => {
    const { GET } = await import("./route");
    const response = await GET(request(), ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="parte-20260101-abcd1234.pdf"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getPdf).toHaveBeenCalledWith("org-1", "f1", "s1", "http://interno:3000");
  });

  it("CA-OUT-12: 401 sin sesión y 403 para un collector", async () => {
    const { GET } = await import("./route");
    requireSession.mockRejectedValueOnce(new UnauthorizedError());
    expect((await GET(request(), ctx)).status).toBe(401);
    requireSession.mockRejectedValueOnce(new ForbiddenError());
    expect((await GET(request(), ctx)).status).toBe(403);
  });

  it("CA-OUT-09: 404 si la respuesta es de otra organización", async () => {
    const { GET } = await import("./route");
    getPdf.mockRejectedValueOnce(new NotFoundError("x"));
    const response = await GET(request(), ctx);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "No se ha encontrado la respuesta." });
  });
});
