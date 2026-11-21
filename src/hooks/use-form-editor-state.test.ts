import { describe, expect, it } from "vitest";
import type { Field } from "@/lib/form-schema";
import {
  findFieldsReferencing,
  formEditorReducer,
  type FormEditorState,
} from "./use-form-editor-state";

const text = (id: string, extra: Partial<Field> = {}): Field =>
  ({ id, type: "text", label: id, required: false, config: {}, ...extra }) as Field;

const base = (fields: Field[]): FormEditorState => ({ title: "T", fields, selectedFieldId: null });

describe("formEditorReducer", () => {
  // Cubre: CA-EDT-01, CA-EDT-08
  it("move-field mueve el tercer campo a la primera posición", () => {
    const s = formEditorReducer(base([text("a"), text("b"), text("c")]), {
      type: "move-field",
      fieldId: "c",
      toIndex: 0,
    });
    expect(s.fields.map((f) => f.id)).toEqual(["c", "a", "b"]);
  });

  // Cubre: CA-EDT-09
  it("add-field añade al final o en un índice y lo selecciona", () => {
    let s = formEditorReducer(base([text("a")]), { type: "add-field", field: text("b") });
    s = formEditorReducer(s, { type: "add-field", field: text("c"), index: 0 });
    expect(s.fields.map((f) => f.id)).toEqual(["c", "a", "b"]);
    expect(s.selectedFieldId).toBe("c");
  });

  // Cubre: CA-EDT-02
  it("fieldsReferencing detecta los campos que dependen de otro y remove-field limpia su visibleIf", () => {
    const fields = [
      text("incidencias"),
      text("comentario", { visibleIf: { fieldId: "incidencias", operator: "isAnswered" } }),
    ];
    expect(findFieldsReferencing(fields, "incidencias").map((f) => f.id)).toEqual(["comentario"]);

    const s = formEditorReducer(base(fields), { type: "remove-field", fieldId: "incidencias" });
    expect(s.fields.map((f) => f.id)).toEqual(["comentario"]);
    expect(s.fields[0].visibleIf).toBeUndefined();
  });

  // Cubre: CA-EDT-11
  it("remove-field sobre un campo sin referencias no toca a los demás", () => {
    const fields = [text("a"), text("b")];
    expect(findFieldsReferencing(fields, "a")).toEqual([]);
    const s = formEditorReducer(base(fields), { type: "remove-field", fieldId: "a" });
    expect(s.fields).toEqual([fields[1]]);
  });

  // Cubre: CA-EDT-11
  it("duplicate-field crea una copia independiente con id distinto", () => {
    const original = text("a", { description: "desc" });
    const s = formEditorReducer(base([original]), { type: "duplicate-field", fieldId: "a", newId: "a2" });
    expect(s.fields).toHaveLength(2);
    expect(s.fields[1].id).toBe("a2");
    expect(s.fields[1].description).toBe("desc");

    const mutated = formEditorReducer(s, { type: "update-field", fieldId: "a2", patch: { label: "Otro" } });
    expect(mutated.fields[0].label).toBe("a");
    expect(mutated.fields[1].label).toBe("Otro");
  });

  // Cubre: CA-EDT-10
  it("update-field cambia propiedades del campo indicado", () => {
    const s = formEditorReducer(base([text("a")]), {
      type: "update-field",
      fieldId: "a",
      patch: { label: "Nuevo", required: true },
    });
    expect(s.fields[0]).toMatchObject({ label: "Nuevo", required: true });
  });
});
