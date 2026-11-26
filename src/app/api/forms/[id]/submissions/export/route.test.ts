import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";

const exportSubmissions = vi.fn();
const requireSession = vi.fn();

vi.mock("@/server/outputs/export.service", () => ({
  exportSubmissions: (...args: unknown[]) => exportSubmissions(...args),
}));
vi.mock("@/server/auth/session", () => ({
  requireSession: (...args: unknown[]) => requireSession(...args),
}));

const ok = {
  filename: "x-respuestas-20260101.csv",
  contentType: "text/csv; charset=utf-8",
  body: Buffer.from("hola"),
  rowCount: 1,
};

function request(search = "format=csv") {
  return new NextRequest(`http://interno:3000/api/forms/f1/submissions/export?${search}`);
}
const ctx = { params: Promise.resolve({ id: "f1" }) };

describe("GET /api/forms/[id]/submissions/export", () => {
  const original = process.env.AUTH_URL;

  beforeEach(() => {
    requireSession.mockResolvedValue({ organizationId: "org-1", role: "admin" });
    exportSubmissions.mockResolvedValue(ok);
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    if (original === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = original;
  });

  // Cubre: RF-OUT-11
  it("RF-OUT-11: usa AUTH_URL (sin barra final) como baseUrl si está definida", async () => {
    process.env.AUTH_URL = "https://publica.test/";
    const { GET } = await import("./route");
    await GET(request(), ctx);
    expect(exportSubmissions).toHaveBeenCalledWith("org-1", "f1", { format: "csv" }, "https://publica.test");
  });

  // Cubre: RF-OUT-11
  it("RF-OUT-11: usa el origin de la petición si AUTH_URL no está definida o está vacía", async () => {
    const { GET } = await import("./route");
    delete process.env.AUTH_URL;
    await GET(request(), ctx);
    process.env.AUTH_URL = "  ";
    await GET(request(), ctx);
    expect(exportSubmissions.mock.calls[0][3]).toBe("http://interno:3000");
    expect(exportSubmissions.mock.calls[1][3]).toBe("http://interno:3000");
  });

  // Cubre: CA-OUT-02, RF-OUT-05
  it("CA-OUT-02: responde 200 con las cabeceras de descarga", async () => {
    const { GET } = await import("./route");
    const response = await GET(request(), ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe(`attachment; filename="${ok.filename}"`);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toBe(ok.contentType);
    expect(requireSession).toHaveBeenCalledWith({ role: "admin" });
  });

  // Cubre: RF-OUT-11, CA-OUT-06
  it("CA-OUT-06: traduce los errores de dominio a 401, 403, 404 y 400", async () => {
    const { GET } = await import("./route");

    requireSession.mockRejectedValueOnce(new UnauthorizedError());
    expect((await GET(request(), ctx)).status).toBe(401);

    requireSession.mockRejectedValueOnce(new ForbiddenError());
    expect((await GET(request(), ctx)).status).toBe(403);

    exportSubmissions.mockRejectedValueOnce(new NotFoundError("interno"));
    const notFound = await GET(request(), ctx);
    expect(notFound.status).toBe(404);
    await expect(notFound.json()).resolves.toEqual({ error: "No se ha encontrado el formulario." });

    exportSubmissions.mockRejectedValueOnce(new ValidationError("demasiadas"));
    expect((await GET(request(), ctx)).status).toBe(400);

    expect((await GET(request("format=pdf"), ctx)).status).toBe(400);
    expect((await GET(request(""), ctx)).status).toBe(400);
  });
});
