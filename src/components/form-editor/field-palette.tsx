"use client";

import { useDraggable } from "@dnd-kit/core";
import { FIELD_PALETTE, type FieldPaletteEntry } from "@/lib/form-editor/field-palette";
import type { FieldType } from "@/lib/form-schema";
import { FieldIcon } from "./field-icon";

export const PALETTE_DRAG_PREFIX = "palette:";

function PaletteItem({
  entry,
  onAdd,
}: {
  entry: FieldPaletteEntry;
  onAdd: (type: FieldType) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_DRAG_PREFIX}${entry.type}`,
  });
  // Enter/Espacio sobre la paleta añaden el campo (clic); no inician un arrastre por teclado.
  const { onKeyDown: _ignored, ...pointerListeners } = listeners ?? {};
  void _ignored;
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-testid={`palette-${entry.type}`}
      onClick={() => onAdd(entry.type)}
      className={`flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted ${
        isDragging ? "opacity-50" : ""
      }`}
      {...pointerListeners}
      {...attributes}
    >
      <FieldIcon name={entry.icon} className="size-4 text-muted-foreground" />
      {entry.label}
    </button>
  );
}

/**
 * Paleta de tipos de campo, arrastrable y pulsable.
 *
 * Cubre: RF-EDT-03, CA-EDT-09
 */
export function FieldPalette({ onAdd }: { onAdd: (type: FieldType) => void }) {
  return (
    <aside aria-label="Tipos de campo" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Añadir campo</h2>
      {FIELD_PALETTE.map((entry) => (
        <PaletteItem key={entry.type} entry={entry} onAdd={onAdd} />
      ))}
    </aside>
  );
}
