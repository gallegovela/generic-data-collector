import { describe, expect, it } from "vitest";
import type { Field, FileRef } from "@/lib/form-schema";
import { formatExportCell } from "./format-cell";

const link = (f: FileRef) => `https://app.test/api/files/${f.key}`;
const base = { label: "L", required: false };

const text: Field = { ...base, id: "t", type: "text", config: {} };
const num: Field = { ...base, id: "n", type: "number", config: {} };
const single: Field = {
  ...base,
  id: "s",
  type: "single_choice",
  config: { display: "radio", options: [{ id: "a", label: "Opción A" }] },
};
const multi: Field = {
  ...base,
  id: "m",
  type: "multiple_choice",
  config: {
    options: [
      { id: "a", label: "Uno" },
      { id: "b", label: "Dos" },
    ],
  },
};
const yesNo: Field = { ...base, id: "y", type: "yes_no", config: {} };
const photo: Field = { ...base, id: "p", type: "photo", config: {} };
const signature: Field = { ...base, id: "f", type: "signature", config: {} };
const gps: Field = { ...base, id: "g", type: "gps", config: {} };
const section: Field = { ...base, id: "sec", type: "section", required: false, config: {} };

describe("formatExportCell", () => {
  // Cubre: RF-OUT-06
  it("RF-OUT-06: texto y número", () => {
    expect(formatExportCell(text, "Hola", link)).toBe("Hola");
    expect(formatExportCell(num, 4.5, link)).toBe(4.5);
  });

  // Cubre: RF-OUT-06
  it("RF-OUT-06: selección única con etiqueta y, si no existe, el id", () => {
    expect(formatExportCell(single, "a", link)).toBe("Opción A");
    expect(formatExportCell(single, "zz", link)).toBe("zz");
  });

  // Cubre: RF-OUT-06
  it("RF-OUT-06: selección múltiple con etiquetas separadas por coma", () => {
    expect(formatExportCell(multi, ["a", "b"], link)).toBe("Uno, Dos");
  });

  // Cubre: RF-OUT-06
  it("RF-OUT-06: sí/no", () => {
    expect(formatExportCell(yesNo, true, link)).toBe("Sí");
    expect(formatExportCell(yesNo, false, link)).toBe("No");
  });

  // Cubre: RF-OUT-06
  it("RF-OUT-06: fotos separadas por salto de línea y firma como enlace", () => {
    expect(formatExportCell(photo, [{ key: "a" }, { key: "b" }], link)).toBe(
      "https://app.test/api/files/a\nhttps://app.test/api/files/b",
    );
    expect(formatExportCell(signature, { key: "s" }, link)).toBe("https://app.test/api/files/s");
  });

  // Cubre: RF-OUT-06
  it("RF-OUT-06: GPS como lat, lng", () => {
    expect(formatExportCell(gps, { lat: 40.4, lng: -3.7, accuracy: 5, capturedAt: "x" }, link)).toBe("40.4, -3.7");
  });

  // Cubre: RF-OUT-06
  it("RF-OUT-06: vacío y sección devuelven null", () => {
    expect(formatExportCell(text, undefined, link)).toBeNull();
    expect(formatExportCell(text, null, link)).toBeNull();
    expect(formatExportCell(photo, [], link)).toBeNull();
    expect(formatExportCell(multi, [], link)).toBeNull();
    expect(formatExportCell(section, "x", link)).toBeNull();
  });

  // Cubre: RF-OUT-12, CA-OUT-05
  it("CA-OUT-05: neutraliza fórmulas en texto y etiquetas pero no toca números", () => {
    expect(formatExportCell(text, "=1+1", link)).toBe("'=1+1");
    expect(formatExportCell(num, -5, link)).toBe(-5);
  });
});
