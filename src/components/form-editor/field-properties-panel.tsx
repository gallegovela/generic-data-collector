"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CONDITION_OPERATORS, type ConditionOperator, type Field, type Option, type VisibleIf } from "@/lib/form-schema";

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "es igual a",
  notEquals: "es distinto de",
  includes: "incluye",
  isAnswered: "está respondido",
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function nextOptionId(options: Option[]): string {
  let n = options.length + 1;
  while (options.some((o) => o.id === `opcion-${n}`)) n += 1;
  return `opcion-${n}`;
}

function toNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: Option[];
  onChange: (options: Option[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Opciones</Label>
      {options.map((option, index) => (
        <div key={option.id} className="flex items-center gap-2">
          <Input
            aria-label={`Opción ${index + 1}`}
            value={option.label}
            onChange={(e) =>
              onChange(options.map((o) => (o.id === option.id ? { ...o, label: e.target.value } : o)))
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Quitar opción ${index + 1}`}
            onClick={() => onChange(options.filter((o) => o.id !== option.id))}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...options, { id: nextOptionId(options), label: `Opción ${options.length + 1}` }])
        }
      >
        <Plus className="size-4" aria-hidden="true" /> Añadir opción
      </Button>
    </div>
  );
}

function VisibilityEditor({
  field,
  previousFields,
  onChange,
}: {
  field: Field;
  previousFields: Field[];
  onChange: (visibleIf: VisibleIf | undefined) => void;
}) {
  const condition = field.visibleIf;
  const source = condition ? previousFields.find((f) => f.id === condition.fieldId) : undefined;
  const candidates = previousFields.filter((f) => f.type !== "section");

  if (!condition) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={candidates.length === 0}
        onClick={() => onChange({ fieldId: candidates[0].id, operator: "isAnswered" })}
      >
        Mostrar solo si…
      </Button>
    );
  }

  const needsValue = condition.operator !== "isAnswered";

  return (
    <div className="flex flex-col gap-2" data-testid="visibility-editor">
      <Label htmlFor="cond-field">Mostrar este campo solo si</Label>
      <select
        id="cond-field"
        className={selectClass}
        value={condition.fieldId}
        onChange={(e) => onChange({ ...condition, fieldId: e.target.value, value: undefined })}
      >
        {!source && <option value={condition.fieldId}>{condition.fieldId}</option>}
        {candidates.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <Label htmlFor="cond-operator">Condición</Label>
      <select
        id="cond-operator"
        className={selectClass}
        value={condition.operator}
        onChange={(e) => {
          const operator = e.target.value as ConditionOperator;
          onChange({
            fieldId: condition.fieldId,
            operator,
            value: operator === "isAnswered" ? undefined : condition.value,
          });
        }}
      >
        {CONDITION_OPERATORS.map((op) => (
          <option key={op} value={op}>
            {OPERATOR_LABELS[op]}
          </option>
        ))}
      </select>
      {needsValue && (
        <>
          <Label htmlFor="cond-value">Valor</Label>
          {source?.type === "yes_no" ? (
            <select
              id="cond-value"
              className={selectClass}
              value={condition.value === undefined ? "" : String(condition.value)}
              onChange={(e) =>
                onChange({
                  ...condition,
                  value: e.target.value === "" ? undefined : e.target.value === "true",
                })
              }
            >
              <option value="">Elige…</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          ) : source?.type === "single_choice" || source?.type === "multiple_choice" ? (
            <select
              id="cond-value"
              className={selectClass}
              value={condition.value === undefined ? "" : String(condition.value)}
              onChange={(e) =>
                onChange({ ...condition, value: e.target.value === "" ? undefined : e.target.value })
              }
            >
              <option value="">Elige…</option>
              {source.config.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id="cond-value"
              type={source?.type === "number" ? "number" : "text"}
              value={condition.value === undefined ? "" : String(condition.value)}
              onChange={(e) => {
                const raw = e.target.value;
                onChange({
                  ...condition,
                  value:
                    raw === ""
                      ? undefined
                      : source?.type === "number"
                        ? (toNumber(raw) ?? undefined)
                        : raw,
                });
              }}
            />
          )}
        </>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
        Quitar condición
      </Button>
    </div>
  );
}

function ConfigEditor({
  field,
  onChange,
}: {
  field: Field;
  onChange: (patch: Partial<Field>) => void;
}) {
  const setConfig = (config: Record<string, unknown>) =>
    onChange({ config: { ...field.config, ...config } } as Partial<Field>);

  switch (field.type) {
    case "text":
      return (
        <>
          <div className="flex items-center justify-between">
            <Label htmlFor="cfg-multiline">Texto largo</Label>
            <Switch
              id="cfg-multiline"
              checked={field.config.multiline ?? false}
              onCheckedChange={(v) => setConfig({ multiline: v })}
            />
          </div>
          <Label htmlFor="cfg-placeholder">Texto de ayuda</Label>
          <Input
            id="cfg-placeholder"
            value={field.config.placeholder ?? ""}
            onChange={(e) => setConfig({ placeholder: e.target.value || undefined })}
          />
        </>
      );
    case "number":
      return (
        <>
          <Label htmlFor="cfg-min">Mínimo</Label>
          <Input
            id="cfg-min"
            type="number"
            value={field.config.min ?? ""}
            onChange={(e) => setConfig({ min: toNumber(e.target.value) })}
          />
          <Label htmlFor="cfg-max">Máximo</Label>
          <Input
            id="cfg-max"
            type="number"
            value={field.config.max ?? ""}
            onChange={(e) => setConfig({ max: toNumber(e.target.value) })}
          />
          <Label htmlFor="cfg-unit">Unidad</Label>
          <Input
            id="cfg-unit"
            value={field.config.unit ?? ""}
            onChange={(e) => setConfig({ unit: e.target.value || undefined })}
          />
        </>
      );
    case "single_choice":
      return (
        <>
          <Label htmlFor="cfg-display">Aspecto</Label>
          <select
            id="cfg-display"
            className={selectClass}
            value={field.config.display}
            onChange={(e) => setConfig({ display: e.target.value })}
          >
            <option value="radio">Botones</option>
            <option value="dropdown">Desplegable</option>
          </select>
          <OptionsEditor options={field.config.options} onChange={(options) => setConfig({ options })} />
        </>
      );
    case "multiple_choice":
      return (
        <OptionsEditor options={field.config.options} onChange={(options) => setConfig({ options })} />
      );
    case "photo":
      return (
        <>
          <Label htmlFor="cfg-maxphotos">Máximo de fotos</Label>
          <Input
            id="cfg-maxphotos"
            type="number"
            min={1}
            value={field.config.maxPhotos ?? ""}
            onChange={(e) => setConfig({ maxPhotos: toNumber(e.target.value) })}
          />
        </>
      );
    case "gps":
      return (
        <div className="flex items-center justify-between">
          <Label htmlFor="cfg-autocapture">Capturar automáticamente</Label>
          <Switch
            id="cfg-autocapture"
            checked={field.config.autoCapture ?? false}
            onCheckedChange={(v) => setConfig({ autoCapture: v })}
          />
        </div>
      );
    default:
      return null;
  }
}

/**
 * Edita el campo seleccionado: propiedades comunes, `config` según el
 * tipo y condición de visibilidad.
 *
 * Cubre: RF-EDT-05, RF-EDT-07, CA-EDT-10, CA-EDT-12
 */
export function FieldPropertiesPanel({
  field,
  previousFields,
  issues,
  onChange,
}: {
  field: Field | null;
  previousFields: Field[];
  issues: string[];
  onChange: (patch: Partial<Field>) => void;
}) {
  if (!field) {
    return (
      <aside aria-label="Propiedades del campo" className="text-sm text-muted-foreground">
        Selecciona un campo para editar sus propiedades.
      </aside>
    );
  }

  return (
    <aside aria-label="Propiedades del campo" className="flex flex-col gap-3" data-testid="properties-panel">
      <h2 className="text-sm font-semibold">Propiedades</h2>
      {issues.length > 0 && (
        <ul role="alert" className="rounded-lg border border-destructive p-2 text-sm text-destructive">
          {issues.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <Label htmlFor="prop-label">Etiqueta</Label>
      <Input
        id="prop-label"
        value={field.label}
        onChange={(e) => onChange({ label: e.target.value })}
      />
      <Label htmlFor="prop-description">Descripción</Label>
      <Textarea
        id="prop-description"
        value={field.description ?? ""}
        onChange={(e) => onChange({ description: e.target.value || undefined })}
      />
      {field.type !== "section" && (
        <div className="flex items-center justify-between">
          <Label htmlFor="prop-required">Obligatorio</Label>
          <Switch
            id="prop-required"
            checked={field.required}
            onCheckedChange={(v) => onChange({ required: v } as Partial<Field>)}
          />
        </div>
      )}
      <ConfigEditor field={field} onChange={onChange} />
      <VisibilityEditor
        field={field}
        previousFields={previousFields}
        onChange={(visibleIf) => onChange({ visibleIf } as Partial<Field>)}
      />
    </aside>
  );
}
