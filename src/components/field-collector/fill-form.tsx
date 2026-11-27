"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { emptyAnswers, hasAnyAnswer } from "@/lib/field-collector/answers";
import { submit, SubmitError, type FillFiles } from "@/lib/field-collector/submit";
import {
  isFieldVisible,
  validateSubmission,
  type FormVersion,
  type ThemeSnapshot,
} from "@/lib/form-schema";
import { FieldRenderer } from "./field-renderer";
import type { PendingFile } from "./photo-input";

export type FillFormView = {
  versionId: string;
  schema: FormVersion;
  theme: ThemeSnapshot;
};

const SUCCESS_REDIRECT_MS = 1200;

function isFileField(type: string): boolean {
  return type === "photo" || type === "signature";
}

/**
 * Pantalla de relleno a pantalla completa de un formulario publicado.
 * `exitPath` es el listado al que se vuelve (usuario con sesión); un anónimo
 * va a `/f/<slug>/thanks` o `/f/<slug>/cancelled`.
 *
 * Cubre: RF-COL-01, RF-COL-02, RF-COL-03, RF-COL-15, RF-COL-16, RF-COL-20
 */
export function FillForm({
  slug,
  form,
  mode,
  exitPath,
}: {
  slug: string;
  form: FillFormView;
  mode: "user" | "anonymous";
  exitPath: string;
}) {
  const router = useRouter();
  const clientId = useRef<string>(crypto.randomUUID());
  const capturedAt = useRef<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, unknown>>(emptyAnswers);
  const [files, setFiles] = useState<Record<string, PendingFile[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendError, setSendError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [website, setWebsite] = useState("");

  const finalPath = mode === "user" ? exitPath : `/f/${slug}/thanks`;
  const cancelPath = mode === "user" ? exitPath : `/f/${slug}/cancelled`;

  /** Respuestas para validar: los archivos pendientes cuentan como respondidos. */
  function answersForValidation(): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...answers };
    for (const field of form.schema.fields) {
      const list = files[field.id] ?? [];
      if (field.type === "photo" && list.length > 0) {
        merged[field.id] = list.map((f) => ({ key: `pending:${f.uploadId}` }));
      } else if (field.type === "signature" && list.length > 0) {
        merged[field.id] = { key: `pending:${list[0].uploadId}` };
      }
    }
    return merged;
  }

  function setValue(fieldId: string, value: unknown) {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[fieldId];
      else next[fieldId] = value;
      return next;
    });
    setErrors((prev) => {
      if (!(fieldId in prev)) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }

  function setFieldFiles(fieldId: string, list: PendingFile[]) {
    setFiles((prev) => ({ ...prev, [fieldId]: list }));
    setErrors((prev) => {
      if (!(fieldId in prev)) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }

  function showErrors(list: Array<{ fieldId: string; message: string }>) {
    const map: Record<string, string> = {};
    for (const item of list) map[item.fieldId] = item.message;
    setErrors(map);
    const first = form.schema.fields.find((f) => f.id in map);
    if (first) {
      requestAnimationFrame(() => {
        const element = document.getElementById(`field-${first.id}`);
        element?.focus();
        element?.scrollIntoView({ block: "center" });
      });
    }
  }

  async function handleSave() {
    if (saving || saved) return;
    const all = answersForValidation();
    const result = validateSubmission(form.schema, all);
    if (!result.success) {
      showErrors(result.errors);
      return;
    }
    setErrors({});
    setSendError(null);
    setSaving(true);
    capturedAt.current ??= new Date().toISOString();

    // Los archivos de campos ocultos no se envían; los FileRef los pone submit().
    const base: Record<string, unknown> = { ...result.data };
    const toUpload: FillFiles = {};
    for (const field of form.schema.fields) {
      if (!isFileField(field.type)) continue;
      delete base[field.id];
      const list = files[field.id] ?? [];
      if (list.length > 0 && isFieldVisible(field, all)) {
        toUpload[field.id] = list.map((f) => ({ uploadId: f.uploadId, kind: f.kind, blob: f.blob }));
      }
    }

    try {
      await submit(
        { slug, versionId: form.versionId, capturedAt: capturedAt.current, website },
        clientId.current,
        base,
        toUpload,
      );
      setSaved(true);
      setTimeout(() => router.push(finalPath), SUCCESS_REDIRECT_MS);
    } catch (error) {
      if (error instanceof SubmitError) {
        if (error.status === 400 && error.fieldErrors.length > 0) {
          const known = new Set(form.schema.fields.map((f) => f.id));
          showErrors(error.fieldErrors.filter((e) => known.has(e.fieldId)));
        }
        setSendError({ message: error.message, retryable: error.retryable });
      } else {
        setSendError({ message: "No se pudo enviar. Reintentar", retryable: true });
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (hasAnyAnswer(answersForValidation())) {
      setDiscardOpen(true);
      return;
    }
    router.push(cancelPath);
  }

  const theme = form.theme;
  const style = {
    ...(theme.primaryColor ? { "--primary": theme.primaryColor } : {}),
    ...(theme.secondaryColor ? { "--secondary": theme.secondaryColor } : {}),
    ...(theme.fontFamily ? { fontFamily: theme.fontFamily } : {}),
  } as React.CSSProperties;

  const visible = form.schema.fields.filter((f) => isFieldVisible(f, answers));

  return (
    <div
      data-testid="fill-form"
      style={style}
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-background"
    >
      <header className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-semibold">{form.schema.title}</h1>
        {form.schema.description ? (
          <p className="mt-1 text-muted-foreground">{form.schema.description}</p>
        ) : null}
      </header>

      <form
        noValidate
        className="flex flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <div className="flex flex-1 flex-col gap-5 px-4 py-4">
          {visible.map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              value={answers[field.id]}
              onValueChange={setValue}
              files={files[field.id] ?? []}
              onFilesChange={setFieldFiles}
              error={errors[field.id]}
            />
          ))}

          {/* Honeypot: invisible para personas, lo rellenan los bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Sitio web
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </label>
          </div>

          {errors._ ? (
            <p role="alert" data-testid="field-error-_" className="text-sm text-destructive">
              {errors._}
            </p>
          ) : null}

          {sendError ? (
            <div role="alert" data-testid="send-error" className="flex flex-col gap-2 text-sm text-destructive">
              {sendError.retryable ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  data-testid="retry"
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  {sendError.message}
                </Button>
              ) : (
                <p>{sendError.message}</p>
              )}
            </div>
          ) : null}

          {saved ? (
            <p
              role="status"
              data-testid="save-success"
              className="rounded-lg bg-primary/10 px-3 py-3 text-center font-medium text-primary"
            >
              Respuesta guardada
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            data-testid="discard"
            disabled={saving || saved}
            onClick={handleDiscard}
          >
            Descartar
          </Button>
          <Button type="submit" className="h-12 text-base" data-testid="save" disabled={saving || saved}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent data-testid="discard-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar lo escrito?</AlertDialogTitle>
            <AlertDialogDescription>
              Se perderá lo que has rellenado y no se guardará nada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="discard-cancel">Seguir rellenando</AlertDialogCancel>
            <AlertDialogAction
              data-testid="discard-yes"
              variant="destructive"
              onClick={() => router.push(cancelPath)}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
