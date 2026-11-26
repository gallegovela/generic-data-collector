"use client";

import { useEffect, useRef, useState } from "react";
import {
  DraftFormSchema,
  mapDraftIssuesToFields,
  type DraftFieldIssue,
  type DraftForm,
} from "@/lib/form-editor/form-editor.schema";
import { saveDraftAction } from "@/server/forms/form.actions";

export type AutosaveStatus =
  | { phase: "idle" | "saving" | "saved" | "error" }
  | { phase: "invalid"; issues: DraftFieldIssue[] };

export const AUTOSAVE_DELAY_MS = 2000;

/**
 * Debounce de 2000 ms desde el último cambio de `draft`. Valida con
 * `DraftFormSchema` antes de llamar al servidor: si no es válido pasa a
 * "invalid" sin guardar. Si el guardado falla pasa a "error".
 *
 * `isPending` es true desde que cambia el borrador hasta que termina su
 * guardado (con éxito o con error).
 *
 * Cubre: RF-EDT-08, RF-EDT-10, CA-EDT-03, CA-EDT-07, RF-PUB-01
 */
export function useAutosaveDraft(
  formId: string,
  draft: DraftForm,
): { status: AutosaveStatus; isPending: boolean } {
  const [status, setStatus] = useState<AutosaveStatus>({ phase: "idle" });
  const [settled, setSettled] = useState<DraftForm>(draft);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const parsed = DraftFormSchema.safeParse(draft);
      if (!parsed.success) {
        setStatus({ phase: "invalid", issues: mapDraftIssuesToFields(draft, parsed.error) });
        setSettled(draft);
        return;
      }
      setStatus({ phase: "saving" });
      try {
        const result = await saveDraftAction(formId, parsed.data);
        if (cancelled) return;
        setStatus(
          result.success ? { phase: "saved" } : { phase: "invalid", issues: result.errors },
        );
      } catch {
        if (cancelled) return;
        setStatus({ phase: "error" });
      }
      setSettled(draft);
    }, AUTOSAVE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formId, draft]);

  return { status, isPending: draft !== settled };
}
