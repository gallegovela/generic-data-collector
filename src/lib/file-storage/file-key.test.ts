import { describe, expect, it } from "vitest";
import { buildFileKey, parseFileKey } from "./file-key";

const UPLOAD = "3f2b8c1e-5d4a-4c7e-9b1a-0a1b2c3d4e5f";

describe("file-key", () => {
  // Cubre: RF-STO-01
  it("construye org/<org>/<kind>/<uploadId>.<ext>", () => {
    expect(
      buildFileKey({
        organizationId: "org1",
        kind: "photo",
        uploadId: UPLOAD,
        contentType: "image/jpeg",
      }),
    ).toBe(`org/org1/photo/${UPLOAD}.jpg`);
    expect(
      buildFileKey({
        organizationId: "org1",
        kind: "document",
        uploadId: UPLOAD,
        contentType: "application/pdf",
      }),
    ).toBe(`org/org1/document/${UPLOAD}.pdf`);
  });

  it("analiza una clave bien formada", () => {
    expect(parseFileKey(`org/org1/signature/${UPLOAD}.png`)).toEqual({
      organizationId: "org1",
      kind: "signature",
      uploadId: UPLOAD,
    });
  });

  it("devuelve null con claves mal formadas o con ..", () => {
    expect(parseFileKey("")).toBeNull();
    expect(parseFileKey(`org/../photo/${UPLOAD}.jpg`)).toBeNull();
    expect(parseFileKey(`org/org1/photo/../${UPLOAD}.jpg`)).toBeNull();
    expect(parseFileKey(`org/org1/logo/${UPLOAD}.jpg`)).toBeNull();
    expect(parseFileKey(`org/org1/photo/${UPLOAD}.exe`)).toBeNull();
    expect(parseFileKey(`x/org1/photo/${UPLOAD}.jpg`)).toBeNull();
    expect(parseFileKey(`org/org1/photo/${UPLOAD}.jpg/extra`)).toBeNull();
  });
});
