import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";

type StoredForm = {
  id: string;
  organizationId: string;
  name: string;
  draftSchema: unknown;
  archivedAt: Date | null;
};

const store = vi.hoisted(() => ({ forms: [] as StoredForm[], seq: 0 }));

vi.mock("./form.repository", () => ({
  listFormsByOrganization: async (organizationId: string) =>
    store.forms
      .filter((f) => f.organizationId === organizationId && !f.archivedAt)
      .map((f) => ({
        id: f.id,
        name: f.name,
        status: "draft",
        publishedVersionLabel: "Sin publicar",
        responseCount: 0,
        updatedAt: new Date(),
      })),
  findFormById: async (organizationId: string, id: string) =>
    store.forms.find((f) => f.id === id && f.organizationId === organizationId) ?? null,
  createForm: async (organizationId: string, data: { name: string; draft: unknown }) => {
    const f: StoredForm = {
      id: `f${++store.seq}`,
      organizationId,
      name: data.name,
      draftSchema: data.draft,
      archivedAt: null,
    };
    store.forms.push(f);
    return f;
  },
  updateFormName: async (organizationId: string, id: string, name: string) => {
    const f = store.forms.find((x) => x.id === id && x.organizationId === organizationId);
    if (!f) return null;
    f.name = name;
    return f;
  },
  updateFormDraft: async (organizationId: string, id: string, draft: unknown) => {
    const f = store.forms.find((x) => x.id === id && x.organizationId === organizationId);
    if (!f) return null;
    f.draftSchema = draft;
    return f;
  },
  archiveForm: async (organizationId: string, id: string) => {
    const f = store.forms.find((x) => x.id === id && x.organizationId === organizationId);
    if (!f) return null;
    f.archivedAt = new Date();
    return f;
  },
}));

import {
  DraftValidationError,
  archiveForm,
  createForm,
  duplicateForm,
  listForms,
  renameForm,
  saveDraft,
} from "./form.service";

const ORG = "org-a";

describe("form.service", () => {
  beforeEach(() => {
    store.forms = [];
    store.seq = 0;
  });

  // Cubre: CA-EDT-04, RF-EDT-02
  it("createForm crea un formulario vacío que aparece en el listado como draft, Sin publicar, 0", async () => {
    const form = await createForm(ORG, { name: "Parte de obra" });
    expect(form.draftSchema).toEqual({ title: "Parte de obra", fields: [] });

    const list = await listForms(ORG);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      name: "Parte de obra",
      status: "draft",
      publishedVersionLabel: "Sin publicar",
      responseCount: 0,
    });
  });

  // Cubre: CA-EDT-05
  it("duplicateForm crea un formulario independiente con el mismo contenido", async () => {
    const source = await createForm(ORG, { name: "Original" });
    await saveDraft(ORG, source.id, {
      draft: {
        title: "Original",
        fields: [{ id: "a", type: "text", label: "A", required: false, config: {} }],
      },
    });

    const copy = await duplicateForm(ORG, { sourceFormId: source.id, name: "Copia" });
    expect(copy.id).not.toBe(source.id);
    expect((copy.draftSchema as { fields: unknown[] }).fields).toHaveLength(1);

    await renameForm(ORG, copy.id, { name: "Copia 2" });
    expect(store.forms.find((f) => f.id === source.id)?.name).toBe("Original");
    expect((await listForms(ORG)).map((f) => f.name).sort()).toEqual(["Copia 2", "Original"]);
  });

  // Cubre: CA-EDT-05, aislamiento
  it("duplicateForm lanza NotFoundError si el origen es de otra organización", async () => {
    const source = await createForm("org-b", { name: "De B" });
    await expect(duplicateForm(ORG, { sourceFormId: source.id, name: "X" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  // Cubre: CA-EDT-06
  it("archiveForm lo quita del listado por defecto", async () => {
    const form = await createForm(ORG, { name: "A archivar" });
    await archiveForm(ORG, form.id);
    expect(await listForms(ORG)).toEqual([]);
  });

  // Cubre: CA-EDT-06, aislamiento
  it("archiveForm y renameForm lanzan NotFoundError con otra organización", async () => {
    const form = await createForm("org-b", { name: "De B" });
    await expect(archiveForm(ORG, form.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(renameForm(ORG, form.id, { name: "X" })).rejects.toBeInstanceOf(NotFoundError);
  });

  // Cubre: CA-EDT-07, RF-EDT-10
  it("saveDraft rechaza un single_choice sin opciones señalando el campo", async () => {
    const form = await createForm(ORG, { name: "F" });
    const draft = {
      title: "F",
      fields: [
        {
          id: "sel",
          type: "single_choice" as const,
          label: "Sel",
          required: false,
          config: { options: [], display: "radio" as const },
        },
      ],
    };
    const error = await saveDraft(ORG, form.id, { draft }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DraftValidationError);
    expect((error as DraftValidationError).issues.every((i) => i.fieldId === "sel")).toBe(true);
  });

  // Cubre: CA-EDT-03
  it("saveDraft lanza NotFoundError si el formulario no es de la organización", async () => {
    const form = await createForm("org-b", { name: "De B" });
    await expect(
      saveDraft(ORG, form.id, { draft: { title: "x", fields: [] } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
