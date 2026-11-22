"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import { FIELD_PALETTE } from "@/lib/form-editor/field-palette";
import type { Field } from "@/lib/form-schema";
import { FieldIcon } from "./field-icon";

export const CANVAS_DROPPABLE_ID = "canvas";

function SortableFieldRow({
  field,
  selected,
  hasIssue,
  onSelect,
  onDuplicate,
  onRemove,
}: {
  field: Field;
  selected: boolean;
  hasIssue: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const entry = FIELD_PALETTE.find((p) => p.type === field.type);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="canvas-field"
      data-field-id={field.id}
      className={`flex items-center gap-2 rounded-lg border bg-background p-2 ${
        hasIssue ? "border-destructive" : selected ? "border-primary ring-2 ring-primary/30" : "border-border"
      } ${isDragging ? "z-10 opacity-70" : ""}`}
    >
      <button
        type="button"
        aria-label={`Reordenar «${field.label}»`}
        data-testid="drag-handle"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        data-testid="field-select"
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
      >
        <FieldIcon name={entry?.icon ?? "Type"} className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{field.label}</span>
        {field.required && <span className="text-destructive">*</span>}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{entry?.label}</span>
      </button>
      <button
        type="button"
        aria-label={`Duplicar «${field.label}»`}
        onClick={onDuplicate}
        className="rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <Copy className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={`Eliminar «${field.label}»`}
        onClick={onRemove}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Lienzo ordenable de campos (`@dnd-kit/sortable`), con arrastre y teclado.
 * El `DndContext` lo aporta `FormEditor`.
 *
 * Cubre: RF-EDT-04, CA-EDT-01, CA-EDT-08
 */
export function FormCanvas({
  fields,
  selectedFieldId,
  invalidFieldIds,
  onSelect,
  onDuplicate,
  onRemove,
}: {
  fields: Field[];
  selectedFieldId: string | null;
  invalidFieldIds: ReadonlySet<string>;
  onSelect: (fieldId: string) => void;
  onDuplicate: (fieldId: string) => void;
  onRemove: (fieldId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID });

  return (
    <div
      ref={setNodeRef}
      data-testid="canvas"
      className={`min-h-48 rounded-xl border-2 border-dashed p-3 ${isOver ? "border-primary" : "border-border"}`}
    >
      {fields.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Arrastra un tipo de campo aquí o pulsa sobre uno de la paleta.
        </p>
      ) : (
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {fields.map((field) => (
              <SortableFieldRow
                key={field.id}
                field={field}
                selected={field.id === selectedFieldId}
                hasIssue={invalidFieldIds.has(field.id)}
                onSelect={() => onSelect(field.id)}
                onDuplicate={() => onDuplicate(field.id)}
                onRemove={() => onRemove(field.id)}
              />
            ))}
          </ul>
        </SortableContext>
      )}
    </div>
  );
}
