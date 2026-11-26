import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConflictError,
  NotFoundError,
  PayloadTooLargeError,
  UnauthorizedError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "@/lib/errors";

const requireSession = vi.fn();
const uploadFile = vi.fn();
const getSignedFileUrl = vi.fn();

vi.mock("@/lib/env", () => ({ getEnv: () => ({ STORAGE_MAX_UPLOAD_BYTES: 10485760 }) }));
vi.mock("@/server/auth/session", () => ({ requireSession: () => requireSession() }));
vi.mock("@/server/storage/storage.service", () => ({
  uploadFile: (...args: unknown[]) => uploadFile(...args),
  getSignedFileUrl: (...args: unknown[]) => getSignedFileUrl(...args),
}));

import { GET, POST } from "./route";

const UPLOAD_ID = "3f2b8c1e-5d4a-4c7e-9b1a-0a1b2c3d4e5f";
const KEY = `org/org1/photo/${UPLOAD_ID}.jpg`;

function uploadRequest(fields: { file?: Blob; kind?: string; uploadId?: string } = {}): Request {
  const form = new FormData();
  form.set("file", fields.file ?? new File([new Uint8Array([0xff, 0xd8, 0xff])], "a.jpg"));
  form.set("kind", fields.kind ?? "photo");
  form.set("uploadId", fields.uploadId ?? UPLOAD_ID);
  return new Request("http://localhost/api/files", { method: "POST", body: form });
}

const stored = { key: KEY, kind: "photo", contentType: "image/jpeg", sizeBytes: 3 };

describe("/api/files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSession.mockResolvedValue({ id: "u1", organizationId: "org1" });
  });

  describe("POST", () => {
    // Cubre: RF-STO-10
    it("devuelve 201 con la clave si es nuevo y 200 si se repite", async () => {
      uploadFile.mockResolvedValueOnce({ file: stored, created: true });
      const created = await POST(uploadRequest());
      expect(created.status).toBe(201);
      expect(await created.json()).toEqual(stored);

      uploadFile.mockResolvedValueOnce({ file: stored, created: false });
      expect((await POST(uploadRequest())).status).toBe(200);
      expect(uploadFile.mock.calls[0][0]).toBe("org1");
    });

    it("sin sesión responde 401", async () => {
      requireSession.mockRejectedValue(new UnauthorizedError());
      expect((await POST(uploadRequest())).status).toBe(401);
      expect(uploadFile).not.toHaveBeenCalled();
    });

    // Cubre: CA-STO-04
    it("rechaza un tipo no admitido con 415", async () => {
      uploadFile.mockRejectedValue(new UnsupportedMediaTypeError());
      expect((await POST(uploadRequest())).status).toBe(415);
    });

    it("rechaza un archivo demasiado grande con 413", async () => {
      uploadFile.mockRejectedValue(new PayloadTooLargeError());
      expect((await POST(uploadRequest())).status).toBe(413);
    });

    it("rechaza por Content-Length sin leer el cuerpo (413)", async () => {
      const request = new Request("http://localhost/api/files", {
        method: "POST",
        headers: { "content-length": String(50 * 1024 * 1024) },
        body: "x",
      });
      expect((await POST(request)).status).toBe(413);
      expect(uploadFile).not.toHaveBeenCalled();
    });

    it("rechaza un archivo vacío (400)", async () => {
      uploadFile.mockRejectedValue(new ValidationError("vacío"));
      expect((await POST(uploadRequest())).status).toBe(400);
    });

    it("rechaza campos inválidos (400) sin llamar al servicio", async () => {
      expect((await POST(uploadRequest({ kind: "logo" }))).status).toBe(400);
      expect((await POST(uploadRequest({ uploadId: "no-uuid" }))).status).toBe(400);
      expect(uploadFile).not.toHaveBeenCalled();
    });

    it("responde 409 si el uploadId se usó con otro kind", async () => {
      uploadFile.mockRejectedValue(new ConflictError("x"));
      expect((await POST(uploadRequest())).status).toBe(409);
    });

    // Cubre: RNF-STO-04
    it("un error interno responde 500 sin detalles en el cuerpo (log)", async () => {
      uploadFile.mockRejectedValue(new Error("secreto interno"));
      const response = await POST(uploadRequest());
      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toContain("secreto");
    });
  });

  describe("GET", () => {
    const get = (query = `?key=${encodeURIComponent(KEY)}`) =>
      GET(new Request(`http://localhost/api/files${query}`));

    // Cubre: CA-STO-03
    it("redirige 302 a la URL firmada con no-store", async () => {
      getSignedFileUrl.mockResolvedValue({ url: "https://s3.test/x?sig=1", expiresInSeconds: 900 });
      const response = await get();
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("https://s3.test/x?sig=1");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(getSignedFileUrl).toHaveBeenCalledWith("org1", KEY);
    });

    it("URL firmada: sin sesión responde 401", async () => {
      requireSession.mockRejectedValue(new UnauthorizedError());
      expect((await get()).status).toBe(401);
    });

    // Cubre: CA-STO-02
    it("archivo de otra organización o inexistente responde 404", async () => {
      getSignedFileUrl.mockRejectedValue(new NotFoundError());
      const response = await get();
      expect(response.status).toBe(404);
    });

    it("archivo de otra organización: sin clave responde 400", async () => {
      expect((await get("")).status).toBe(400);
      expect(getSignedFileUrl).not.toHaveBeenCalled();
    });
  });
});
