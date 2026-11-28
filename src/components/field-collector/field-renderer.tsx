"use client";

import { useState } from "react";
import type { Field, GpsAnswer } from "@/lib/form-schema";
import { GpsInput } from "./gps-input";
import { PhotoInput, type PendingFile } from "./photo-input";
import { SignaturePad } from "./signature-pad";

const CONTROL =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

type Props = {
  field: Field;
  value: unknown;
  onValueChange: (fieldId: string, value: unknown) => void;
  files: PendingFile[];
  onFilesChange: (fieldId: string, files: PendingFile[]) => void;
  error?: string;
};

/** Convierte "YYYY-MM-DDTHH:mm" (hora local) a ISO UTC; "" → undefined. */
function localToIso(local: string): string | undefined {
  if (local === "") return undefined;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function NumberControl({
  field,
  value,
  onValueChange,
  invalid,
}: Pick<Props, "onValueChange" | "value"> & {
  field: Extract<Field, { type: "number" }>;
  invalid: boolean;
}) {
  const [raw, setRaw] = useState(typeof value === "number" ? String(value) : "");
  const step = field.config.decimals === 0 ? "1" : field.config.decimals ? `0.${"0".repeat(field.config.decimals - 1)}1` : "any";
  return (
    <div className="flex items-center gap-2">
      <input
        id={`field-${field.id}`}
        data-testid={`field-${field.id}`}
        type="number"
        inputMode="decimal"
        step={step}
        value={raw}
        aria-invalid={invalid}
        className={CONTROL}
        onChange={(event) => {
          setRaw(event.target.value);
          const parsed = event.target.value === "" ? undefined : Number(event.target.value);
          onValueChange(field.id, parsed === undefined || Number.isNaN(parsed) ? undefined : parsed);
        }}
      />
      {field.config.unit ? <span className="text-sm text-muted-foreground">{field.config.unit}</span> : null}
    </div>
  );
}

function isoToLocal(iso: unknown): string {
  if (typeof iso !== "string") return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function DateTimeControl({
  field,
  value,
  onValueChange,
  invalid,
}: Pick<Props, "onValueChange" | "value"> & {
  field: Extract<Field, { type: "datetime" }>;
  invalid: boolean;
}) {
  const [raw, setRaw] = useState(isoToLocal(value));
  return (
    <input
      id={`field-${field.id}`}
      data-testid={`field-${field.id}`}
      type="datetime-local"
      value={raw}
      aria-invalid={invalid}
      className={CONTROL}
      onChange={(event) => {
        setRaw(event.target.value);
        onValueChange(field.id, localToIso(event.target.value));
      }}
    />
  );
}

function Control({ field, value, onValueChange, files, onFilesChange, error }: Props) {
  const invalid = error !== undefined;
  const set = (v: unknown) => onValueChange(field.id, v);
  const text = typeof value === "string" ? value : "";

  switch (field.type) {
    case "text":
      return field.config.multiline ? (
        <textarea
          id={`field-${field.id}`}
          data-testid={`field-${field.id}`}
          rows={4}
          value={text}
          placeholder={field.config.placeholder}
          maxLength={field.config.maxLength}
          aria-invalid={invalid}
          className={CONTROL}
          onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
        />
      ) : (
        <input
          id={`field-${field.id}`}
          data-testid={`field-${field.id}`}
          type="text"
          value={text}
          placeholder={field.config.placeholder}
          maxLength={field.config.maxLength}
          aria-invalid={invalid}
          className={CONTROL}
          onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
        />
      );
    case "number":
      return <NumberControl field={field} value={value} onValueChange={onValueChange} invalid={invalid} />;
    case "date":
      return (
        <input
          id={`field-${field.id}`}
          data-testid={`field-${field.id}`}
          type="date"
          value={text}
          min={field.config.min}
          max={field.config.max}
          aria-invalid={invalid}
          className={CONTROL}
          onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
        />
      );
    case "time":
      return (
        <input
          id={`field-${field.id}`}
          data-testid={`field-${field.id}`}
          type="time"
          value={text}
          aria-invalid={invalid}
          className={CONTROL}
          onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
        />
      );
    case "datetime":
      return <DateTimeControl field={field} value={value} onValueChange={onValueChange} invalid={invalid} />;
    case "single_choice":
      return field.config.display === "dropdown" ? (
        <select
          id={`field-${field.id}`}
          data-testid={`field-${field.id}`}
          value={text}
          aria-invalid={invalid}
          className={CONTROL}
          onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
        >
          <option value="">Selecciona una opción</option>
          {field.config.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <div id={`field-${field.id}`} tabIndex={-1} role="radiogroup" className="flex flex-col gap-2">
          {field.config.options.map((o) => (
            <label
              key={o.id}
              className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-base"
            >
              <input
                type="radio"
                name={`field-${field.id}`}
                value={o.id}
                checked={text === o.id}
                className="size-5"
                onChange={() => set(o.id)}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    case "multiple_choice": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div id={`field-${field.id}`} tabIndex={-1} className="flex flex-col gap-2">
          {field.config.options.map((o) => (
            <label
              key={o.id}
              className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-base"
            >
              <input
                type="checkbox"
                value={o.id}
                checked={selected.includes(o.id)}
                className="size-5"
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selected, o.id]
                    : selected.filter((s) => s !== o.id);
                  set(next.length === 0 ? undefined : next);
                }}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    }
    case "yes_no":
      return (
        <div id={`field-${field.id}`} tabIndex={-1} role="radiogroup" className="grid grid-cols-2 gap-2">
          {[
            { v: true, label: "Sí" },
            { v: false, label: "No" },
          ].map((o) => (
            <label
              key={o.label}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-base font-medium ${
                value === o.v ? "border-primary bg-primary text-primary-foreground" : ""
              }`}
            >
              <input
                type="radio"
                name={`field-${field.id}`}
                value={String(o.v)}
                checked={value === o.v}
                className="sr-only"
                onChange={() => set(o.v)}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    case "photo":
      return (
        <PhotoInput
          fieldId={field.id}
          items={files}
          onChange={(items) => onFilesChange(field.id, items)}
          maxPhotos={field.config.maxPhotos}
          allowGallery={field.config.allowGallery}
          invalid={invalid}
        />
      );
    case "signature":
      return (
        <SignaturePad
          fieldId={field.id}
          value={files[0] ?? null}
          onChange={(item) => onFilesChange(field.id, item ? [item] : [])}
          invalid={invalid}
        />
      );
    case "gps":
      return (
        <GpsInput
          fieldId={field.id}
          value={value as GpsAnswer | undefined}
          onChange={(v) => set(v)}
          autoCapture={field.config.autoCapture}
        />
      );
    case "section":
      return null;
  }
}

/**
 * Un campo del formulario: etiqueta, control según el tipo y error junto al
 * campo.
 *
 * Cubre: RF-COL-02, RF-COL-03
 */
export function FieldRenderer(props: Props) {
  const { field, error } = props;

  if (field.type === "section") {
    return (
      <div data-testid={`section-${field.id}`} className="pt-4">
        <h2 className="text-lg font-semibold">{field.label}</h2>
        {field.description ? <p className="text-sm text-muted-foreground">{field.description}</p> : null}
      </div>
    );
  }

  return (
    <div data-testid={`field-wrapper-${field.id}`} className="flex flex-col gap-1.5">
      <label htmlFor={`field-${field.id}`} className="text-base font-medium">
        {field.label}
        {field.required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {field.description ? <p className="text-sm text-muted-foreground">{field.description}</p> : null}
      <Control {...props} />
      {error ? (
        <p role="alert" data-testid={`field-error-${field.id}`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
