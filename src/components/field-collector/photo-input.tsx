"use client";

import { newUuid } from "@/lib/field-collector/uuid";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

export type PendingFile = {
  uploadId: string;
  kind: "photo" | "signature";
  blob: Blob;
  previewUrl: string;
};

/**
 * Foto(s) de un campo: cámara o galería según `allowGallery`, con tope de
 * `maxPhotos`. Los archivos se suben al guardar.
 *
 * Cubre: RF-COL-09
 */
export function PhotoInput({
  fieldId,
  items,
  onChange,
  maxPhotos,
  allowGallery,
  invalid,
}: {
  fieldId: string;
  items: PendingFile[];
  onChange: (items: PendingFile[]) => void;
  maxPhotos?: number;
  allowGallery?: boolean;
  invalid: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const full = maxPhotos !== undefined && items.length >= maxPhotos;

  function handleFiles(list: FileList | null) {
    if (!list) return;
    const room = maxPhotos === undefined ? list.length : Math.max(0, maxPhotos - items.length);
    const added: PendingFile[] = Array.from(list)
      .slice(0, room)
      .map((file) => ({
        uploadId: newUuid(),
        kind: "photo" as const,
        blob: file,
        previewUrl: URL.createObjectURL(file),
      }));
    onChange([...items, ...added]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(uploadId: string) {
    const target = items.find((i) => i.uploadId === uploadId);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(items.filter((i) => i.uploadId !== uploadId));
  }

  return (
    <div id={`field-${fieldId}`} tabIndex={-1} className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture={allowGallery === false ? "environment" : undefined}
        multiple={maxPhotos === undefined || maxPhotos > 1}
        data-testid={`photo-input-${fieldId}`}
        className="sr-only"
        tabIndex={-1}
        aria-invalid={invalid}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full text-base"
        disabled={full}
        onClick={() => inputRef.current?.click()}
      >
        {allowGallery === false ? "Hacer foto" : "Añadir foto"}
      </Button>
      {items.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <li key={item.uploadId} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt="Foto añadida"
                className="aspect-square w-full rounded-lg border object-cover"
              />
              <button
                type="button"
                aria-label="Quitar foto"
                className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-background/90 text-sm shadow"
                onClick={() => remove(item.uploadId)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
