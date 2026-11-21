import { describe, expect, it } from "vitest";
import { FormVersionSchema } from "../form-version.schema";
import { demoForms } from "./demo-forms";

describe("demo forms", () => {
  it("CA-FSC-04 — the three demo forms are valid", () => {
    expect(demoForms).toHaveLength(3);
    for (const form of demoForms) {
      const result = FormVersionSchema.safeParse(form);
      expect(result.success, form.title).toBe(true);
    }
  });
});
