import { describe, expect, it } from "vitest";
import * as api from "./index";

describe("index", () => {
  it("RF-FSC-01 — exposes the public API", () => {
    for (const name of [
      "FormVersionSchema",
      "FieldSchema",
      "VisibleIfSchema",
      "ThemeSnapshotSchema",
      "buildFieldAnswerSchema",
      "validateSubmission",
      "getVisibleFields",
      "demoForms",
    ]) {
      expect(api).toHaveProperty(name);
    }
  });
});
