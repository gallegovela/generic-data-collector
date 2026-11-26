"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";
import { generateFieldId, useFormEditorState } from "@/hooks/use-form-editor-state";
import { FIELD_PALETTE } from "@/lib/form-editor/field-palette";
import type { DraftForm } from "@/lib/form-editor/form-editor.schema";
import { PublishPanel } from "@/components/form-publishing/publish-panel";
import { canPublishDraft } from "@/lib/form-publishing/can-publish";
import type { FieldType } from "@/lib/form-schema";
import type { PublishingState } from "@/server/form-publishing/form-publishing.service";
import { AutosaveIndicator } from "./autosave-indicator";
import { FieldPalette, PALETTE_DRAG_PREFIX } from "./field-palette";
import { FieldPropertiesPanel } from "./field-properties-panel";
import { FormCanvas } from "./form-canvas";
import { MobilePreview } from "./mobile-preview";

/**
 * Orquesta paleta, lienzo, panel de propiedades y vista previa.
 *
 * Cubre: RF-EDT-03 a RF-EDT-10, RF-EDT-12
 */
export function FormEditor({
  formId,
  formName,
  initialDraft,
  publishingState,
}: {
  formId: string;
  formName: string;
  initialDraft: DraftForm;
  publishingState: PublishingState;
}) {
  const { state, dispatch, fieldsReferencingId } = useFormEditorState(initialDraft);
  const [showPreview, setShowPreview] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const draft = useMemo<DraftForm>(
    () => ({ title: state.title, description: initialDraft.description, fields: state.fields }),
    [state.title, state.fields, initialDraft.description],
  );
  const { status, isPending } = useAutosaveDraft(formId, draft);
  const canPublish = canPublishDraft(status.phase, isPending);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addField = (type: FieldType, index?: number) => {
    const entry = FIELD_PALETTE.find((p) => p.type === type);
    if (!entry) return;
    dispatch({ type: "add-field", field: entry.buildDefaultField(generateFieldId()), index });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId) return;
    const overIndex = state.fields.findIndex((f) => f.id === overId);

    if (activeId.startsWith(PALETTE_DRAG_PREFIX)) {
      addField(activeId.slice(PALETTE_DRAG_PREFIX.length) as FieldType, overIndex === -1 ? undefined : overIndex);
    } else if (overIndex !== -1 && activeId !== overId) {
      dispatch({ type: "move-field", fieldId: activeId, toIndex: overIndex });
    }
  };

  const removeField = (fieldId: string) => {
    const dependents = fieldsReferencingId(fieldId);
    setNotice(
      dependents.length > 0
        ? `${dependents.map((f) => `«${f.label}»`).join(", ")} dependía de este campo; se ha eliminado su condición de visibilidad.`
        : null,
    );
    dispatch({ type: "remove-field", fieldId });
  };

  const invalidIssues = status.phase === "invalid" ? status.issues : [];
  const invalidFieldIds = new Set(invalidIssues.map((i) => i.fieldId));
  const selected = state.fields.find((f) => f.id === state.selectedFieldId) ?? null;
  const selectedIndex = selected ? state.fields.indexOf(selected) : -1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/forms" className="text-sm text-muted-foreground hover:underline">
          ← Formularios
        </Link>
        <Input
          aria-label="Título del formulario"
          className="max-w-sm font-semibold"
          value={state.title}
          onChange={(e) => dispatch({ type: "rename-title", title: e.target.value })}
        />
        <span className="text-xs text-muted-foreground">{formName}</span>
        <div className="ml-auto flex items-center gap-3">
          <AutosaveIndicator status={status} fields={state.fields} />
          <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? "Ocultar vista previa" : "Vista previa"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Disponible próximamente"
          >
            <Sparkles className="size-4" aria-hidden="true" /> Pedir cambios a la IA
          </Button>
        </div>
      </div>

      <PublishPanel
        formId={formId}
        initialState={publishingState}
        canPublish={canPublish}
        saveFailed={status.phase === "error"}
      />

      {notice && (
        <p role="status" data-testid="editor-notice" className="rounded-lg border border-amber-400 bg-amber-50 p-2 text-sm text-amber-900">
          {notice}
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="grid gap-6 lg:grid-cols-[14rem_1fr_18rem]">
          <FieldPalette onAdd={(type) => addField(type)} />
          <FormCanvas
            fields={state.fields}
            selectedFieldId={state.selectedFieldId}
            invalidFieldIds={invalidFieldIds}
            onSelect={(fieldId) => dispatch({ type: "select-field", fieldId })}
            onDuplicate={(fieldId) => dispatch({ type: "duplicate-field", fieldId })}
            onRemove={removeField}
          />
          <div className="flex flex-col gap-6">
            <FieldPropertiesPanel
              field={selected}
              previousFields={selectedIndex > 0 ? state.fields.slice(0, selectedIndex) : []}
              issues={invalidIssues.filter((i) => i.fieldId === selected?.id).map((i) => i.message)}
              onChange={(patch) => selected && dispatch({ type: "update-field", fieldId: selected.id, patch })}
            />
            {showPreview && <MobilePreview title={state.title} fields={state.fields} />}
          </div>
        </div>
      </DndContext>
    </div>
  );
}
