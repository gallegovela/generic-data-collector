"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AccessModeSchema,
  type AccessMode,
} from "@/lib/form-publishing/form-publishing.schema";
import {
  publishFormAction,
  setAccessModeAction,
  unpublishFormAction,
} from "@/server/form-publishing/form-publishing.actions";
import type { PublishingState } from "@/server/form-publishing/form-publishing.service";

const ACCESS_LABELS: Record<AccessMode, string> = {
  registered: "Solo usuarios registrados",
  public: "Público con enlace",
};

/**
 * Publicar, modo de acceso, enlace, QR y despublicar.
 *
 * Cubre: RF-PUB-01, RF-PUB-04, RF-PUB-05, RF-PUB-06, RF-PUB-09, RF-PUB-11
 */
export function PublishPanel({
  formId,
  initialState,
  canPublish,
  saveFailed = false,
}: {
  formId: string;
  initialState: PublishingState;
  /** false mientras el autoguardado no haya terminado o el borrador no sea válido */
  canPublish: boolean;
  /** true si el último autoguardado falló */
  saveFailed?: boolean;
}) {
  const [state, setState] = useState<PublishingState>(initialState);
  const [accessMode, setAccessMode] = useState<AccessMode>(initialState.accessMode);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const published = state.status === "published";
  const badge = published
    ? `Publicado v${state.publishedVersion}`
    : state.slug
      ? "Despublicado"
      : "Borrador";

  const publish = () => {
    setError(null);
    setIssues([]);
    startTransition(async () => {
      const result = await publishFormAction(formId, { accessMode });
      if (!result.ok) {
        setError(result.error);
        setIssues(result.issues ?? []);
        return;
      }
      setState({
        status: "published",
        slug: result.slug,
        accessMode,
        publishedVersion: result.version,
        link: result.link,
      });
    });
  };

  const changeMode = (value: string) => {
    const parsed = AccessModeSchema.safeParse(value);
    if (!parsed.success) return;
    setAccessMode(parsed.data);
    if (!published) return;
    setError(null);
    startTransition(async () => {
      const result = await setAccessModeAction(formId, { accessMode: parsed.data });
      if (!result.ok) {
        setError(result.error);
        setAccessMode(state.accessMode);
        return;
      }
      setState((s) => ({ ...s, accessMode: parsed.data }));
    });
  };

  const unpublish = () => {
    setConfirmOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await unpublishFormAction(formId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setState((s) => ({ ...s, status: "draft" }));
    });
  };

  const copyLink = async () => {
    if (!state.link) return;
    try {
      await navigator.clipboard.writeText(state.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar el enlace.");
    }
  };

  const qrBase = `/api/forms/${formId}/qr`;

  return (
    <section
      aria-label="Publicación"
      data-testid="publish-panel"
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={published ? "default" : "secondary"} data-testid="publish-status">
          {badge}
        </Badge>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Acceso</span>
          <select
            data-testid="access-mode"
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={accessMode}
            disabled={pending}
            onChange={(e) => changeMode(e.target.value)}
          >
            {AccessModeSchema.options.map((mode) => (
              <option key={mode} value={mode}>
                {ACCESS_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          size="sm"
          data-testid="publish-button"
          disabled={!canPublish || pending}
          onClick={publish}
        >
          {published ? "Publicar cambios" : "Publicar"}
        </Button>
        {published && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="unpublish-button"
            disabled={pending}
            onClick={() => setConfirmOpen(true)}
          >
            Despublicar
          </Button>
        )}
      </div>

      {saveFailed && (
        <p role="alert" data-testid="publish-blocked" className="text-sm text-destructive">
          No se pudo guardar el borrador; reinténtalo antes de publicar
        </p>
      )}

      {error && (
        <div role="alert" data-testid="publish-error" className="text-sm text-destructive">
          <p>{error}</p>
          {issues.length > 0 && (
            <ul className="list-disc pl-5">
              {issues.map((issue, i) => (
                <li key={`${issue.path}-${i}`}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.link && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input readOnly aria-label="Enlace del formulario" data-testid="form-link" value={state.link} />
            <Button type="button" size="sm" variant="outline" onClick={copyLink}>
              {copied ? "Copiado" : "Copiar enlace"}
            </Button>
          </div>
          {published && (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${qrBase}?format=png&v=${state.publishedVersion}`}
                alt="Código QR del formulario"
                data-testid="form-qr"
                width={128}
                height={128}
              />
              <div className="flex flex-col gap-1 text-sm">
                <a className="underline" href={`${qrBase}?format=png&download=1`}>
                  Descargar PNG
                </a>
                <a className="underline" href={`${qrBase}?format=svg&download=1`}>
                  Descargar SVG
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Despublicar formulario</AlertDialogTitle>
            <AlertDialogDescription>
              El enlace dejará de aceptar respuestas. Podrás volver a publicarlo con el mismo enlace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button type="button" variant="destructive" data-testid="unpublish-confirm" onClick={unpublish}>
              Despublicar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
