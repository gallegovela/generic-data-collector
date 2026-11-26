import { describe, expect, it } from "vitest";
import { ALLOWED_CONTENT_TYPES } from "./file-storage.schema";
import { detectFileType } from "./file-type";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => Array.from(value, (c) => c.charCodeAt(0));

const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const WEBP = bytes(...text("RIFF"), 1, 2, 3, 4, ...text("WEBP"));
const heic = (brand: string) => bytes(0, 0, 0, 24, ...text("ftyp"), ...text(brand));
const PDF = bytes(...text("%PDF-1.7"));

describe("detectFileType", () => {
  // Cubre: RF-STO-04
  it("detecta los 5 formatos por su firma binaria", () => {
    expect(detectFileType(JPG)).toBe("image/jpeg");
    expect(detectFileType(PNG)).toBe("image/png");
    expect(detectFileType(WEBP)).toBe("image/webp");
    expect(detectFileType(heic("heic"))).toBe("image/heic");
    expect(detectFileType(PDF)).toBe("application/pdf");
  });

  it("detecta HEIC con ftyp en los bytes 4-11 y cualquiera de sus marcas", () => {
    for (const brand of ["heic", "heix", "heif", "mif1", "msf1", "hevc"]) {
      expect(detectFileType(heic(brand))).toBe("image/heic");
    }
    expect(detectFileType(heic("isom"))).toBeNull();
  });

  it("devuelve null para tipos desconocidos, vacíos o demasiado cortos", () => {
    expect(detectFileType(bytes(...text("hola mundo, esto es texto")))).toBeNull();
    expect(detectFileType(new Uint8Array())).toBeNull();
    expect(detectFileType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectFileType(bytes(...text("RIFF"), 1, 2, 3, 4, ...text("WAVE")))).toBeNull();
  });

  it("rechaza tipos no permitidos por clase de archivo", () => {
    expect(ALLOWED_CONTENT_TYPES.signature).toEqual(["image/png"]);
    expect(ALLOWED_CONTENT_TYPES.photo).not.toContain("application/pdf");
    expect(ALLOWED_CONTENT_TYPES.document).toEqual(["application/pdf"]);
  });
});
