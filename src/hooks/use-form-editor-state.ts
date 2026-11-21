"use client";

import { useCallback, useReducer } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import type { Field } from "@/lib/form-schema";
import type { DraftForm } from "@/lib/form-editor/form-editor.schema";

export type FormEditorState = {
  title: string;
  fields: Field[];
  selectedFieldId: string | null;
};

export type FormEditorAction =
  | { type: "add-field"; field: Field; index?: number }
  | { type: "move-field"; fieldId: string; toIndex: number } // arrastre o teclado (CA-EDT-01, CA-EDT-08)
  | { type: "update-field"; fieldId: string; patch: Partial<Field> }
  | { type: "remove-field"; fieldId: string } // también limpia visibleIf que lo referencien (CA-EDT-02)
  | { type: "duplicate-field"; fieldId: string; newId?: string }
  | { type: "select-field"; fieldId: string | null }
  | { type: "rename-title"; title: string };

export function generateFieldId(): string {
  return `campo-${crypto.randomUUID().slice(0, 8)}`;
}

/** Campos cuya condición de visibilidad depende de `fieldId` (CA-EDT-02). */
export function findFieldsReferencing(fields: Field[], fieldId: string): Field[] {
  return fields.filter((f) => f.visibleIf?.fieldId === fieldId);
}

/** Reductor puro del editor. Cubre: CA-EDT-01, CA-EDT-02, CA-EDT-08, CA-EDT-09, CA-EDT-11 */
export function formEditorReducer(state: FormEditorState, action: FormEditorAction): FormEditorState {
  switch (action.type) {
    case "add-field": {
      const fields = [...state.fields];
      const index = action.index ?? fields.length;
      fields.splice(Math.max(0, Math.min(index, fields.length)), 0, action.field);
      return { ...state, fields, selectedFieldId: action.field.id };
    }
    case "move-field": {
      const from = state.fields.findIndex((f) => f.id === action.fieldId);
      if (from === -1) return state;
      const to = Math.max(0, Math.min(action.toIndex, state.fields.length - 1));
      return { ...state, fields: arrayMove(state.fields, from, to) };
    }
    case "update-field":
      return {
        ...state,
        fields: state.fields.map((f) =>
          f.id === action.fieldId ? ({ ...f, ...action.patch } as Field) : f,
        ),
      };
    case "remove-field": {
      const fields = state.fields
        .filter((f) => f.id !== action.fieldId)
        .map((f) => {
          if (f.visibleIf?.fieldId !== action.fieldId) return f;
          const { visibleIf: _removed, ...rest } = f;
          void _removed;
          return rest as Field;
        });
      return {
        ...state,
        fields,
        selectedFieldId: state.selectedFieldId === action.fieldId ? null : state.selectedFieldId,
      };
    }
    case "duplicate-field": {
      const index = state.fields.findIndex((f) => f.id === action.fieldId);
      if (index === -1) return state;
      const original = state.fields[index];
      const copy = {
        ...structuredClone(original),
        id: action.newId ?? generateFieldId(),
        label: `${original.label} (copia)`,
      } as Field;
      const fields = [...state.fields];
      fields.splice(index + 1, 0, copy);
      return { ...state, fields, selectedFieldId: copy.id };
    }
    case "select-field":
      return { ...state, selectedFieldId: action.fieldId };
    case "rename-title":
      return { ...state, title: action.title };
  }
}

export function useFormEditorState(initial: DraftForm): {
  state: FormEditorState;
  dispatch: (action: FormEditorAction) => void;
  fieldsReferencingId: (fieldId: string) => Field[];
} {
  const [state, dispatch] = useReducer(formEditorReducer, {
    title: initial.title,
    fields: initial.fields,
    selectedFieldId: null,
  });
  const fieldsReferencingId = useCallback(
    (fieldId: string) => findFieldsReferencing(state.fields, fieldId),
    [state.fields],
  );
  return { state, dispatch, fieldsReferencingId };
}
