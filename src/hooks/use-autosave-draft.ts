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
  | { phase: "idle" | "saving" | "saved" }
  | { phase: "invalid"; issues: DraftFieldIssue[] };

export const AUTOSAVE_DELAY_MS = 2000;

/**
 * Debounce de 2000 ms desde el último cambio de `draft`. Valida con
 * `DraftFormSchema` antes de llamar al servidor: si no es válido pasa a
 * "invalid" sin guardar.
 *
 * Cubre: RF-EDT-08, RF-EDT-10, CA-EDT-03, CA-EDT-07
 */
export function useAutosaveDraft(formId: string, draft: DraftForm): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>({ phase: "idle" });
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
        if (!cancelled) setStatus({ phase: "invalid", issues: [] });
      }
    }, AUTOSAVE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formId, draft]);

  return status;
}
