"use client";

import { newUuid } from "@/lib/field-collector/uuid";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PendingFile } from "./photo-input";

/**
 * Firma en un canvas con pointer events (sin dependencias). Exporta un PNG.
 *
 * Cubre: RF-COL-10
 */
export function SignaturePad({
  fieldId,
  value,
  onChange,
  invalid,
}: {
  fieldId: string;
  value: PendingFile | null;
  onChange: (value: PendingFile | null) => void;
  invalid: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [hasInk, setHasInk] = useState(value !== null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Un punto aislado también cuenta como trazo.
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    dirty.current = true;
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = event.currentTarget;
    if (!dirty.current) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (value) URL.revokeObjectURL(value.previewUrl);
      setHasInk(true);
      onChange({
        uploadId: newUuid(),
        kind: "signature",
        blob,
        previewUrl: URL.createObjectURL(blob),
      });
    }, "image/png");
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    if (value) URL.revokeObjectURL(value.previewUrl);
    dirty.current = false;
    setHasInk(false);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        id={`field-${fieldId}`}
        tabIndex={-1}
        data-testid={`signature-canvas-${fieldId}`}
        aria-label="Zona de firma"
        aria-invalid={invalid}
        className="h-40 w-full touch-none rounded-lg border bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <Button
        type="button"
        variant="outline"
        className="h-11"
        disabled={!hasInk}
        onClick={clear}
      >
        Borrar firma
      </Button>
    </div>
  );
}
