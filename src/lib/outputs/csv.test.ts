import { describe, expect, it } from "vitest";
import { serializeCsv } from "./csv";

describe("serializeCsv", () => {
  // Cubre: RNF-OUT-04
  it("RNF-OUT-04: BOM, separador ; y filas terminadas en \\r\\n", () => {
    const csv = serializeCsv({ headers: ["A", "B"], rows: [["x", 2], [null, "y"]] });
    expect(csv).toBe("﻿A;B\r\nx;2\r\n;y");
    expect(csv.startsWith("﻿")).toBe(true);
  });

  // Cubre: RNF-OUT-04
  it("RNF-OUT-04: entrecomilla celdas con ;, comillas y saltos de línea", () => {
    const csv = serializeCsv({ headers: ["H"], rows: [["a;b"], ['di "hola"'], ["l1\nl2"]] });
    expect(csv).toBe('﻿H\r\n"a;b"\r\n"di ""hola"""\r\n"l1\nl2"');
  });

  // Cubre: CA-OUT-05
  it("CA-OUT-05: una celda ya neutralizada sale como '=1+1", () => {
    expect(serializeCsv({ headers: ["H"], rows: [["'=1+1"]] })).toContain("\r\n'=1+1");
  });
});
