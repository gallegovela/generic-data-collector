"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  regenerateWebhookSecretAction,
  removeDestinationAction,
  saveEmailDestinationAction,
  saveWebhookDestinationAction,
} from "@/server/outputs/destination.actions";
import type { DestinationView } from "@/server/outputs/destination.service";

type Failure = { error: string; issues?: { path: string; message: string }[] };

function messageOf(result: Failure): string {
  return result.issues?.[0]?.message ?? result.error;
}

/** Destinos de un formulario: email con PDF y webhook firmado. Cubre: RF-OUT-01, RF-OUT-07, RF-OUT-16 */
export function DestinationsPanel({
  formId,
  destinations,
}: {
  formId: string;
  destinations: DestinationView[];
}) {
  const email = destinations.find((d) => d.kind === "email");
  const webhook = destinations.find((d) => d.kind === "webhook");

  const [emails, setEmails] = useState((email?.emails ?? []).join(", "));
  const [url, setUrl] = useState(webhook?.webhookUrl ?? "");
  const [secret, setSecret] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveEmail() {
    setEmailMessage(null);
    startTransition(async () => {
      const list = emails
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter(Boolean);
      const result = await saveEmailDestinationAction(formId, { emails: list, enabled: true });
      setEmailMessage(result.ok ? "Guardado." : messageOf(result));
    });
  }

  function saveWebhook() {
    setWebhookMessage(null);
    startTransition(async () => {
      const result = await saveWebhookDestinationAction(formId, { url, enabled: true });
      if (!result.ok) {
        setWebhookMessage(messageOf(result));
        return;
      }
      if (result.secret) setSecret(result.secret);
      setWebhookMessage("Guardado.");
    });
  }

  function regenerate() {
    startTransition(async () => {
      const result = await regenerateWebhookSecretAction(formId);
      if (result.ok) setSecret(result.secret);
      else setWebhookMessage(messageOf(result));
    });
  }

  function remove(kind: "email" | "webhook") {
    startTransition(async () => {
      await removeDestinationAction(formId, kind);
      if (kind === "email") setEmails("");
      else {
        setUrl("");
        setSecret(null);
      }
    });
  }

  return (
    <div className="space-y-4" data-testid="destinations-panel">
      <p className="rounded-lg border bg-muted/40 p-3 text-sm" data-testid="gdpr-notice">
        Las respuestas pueden contener datos personales. Eres responsable de elegir destinatarios
        autorizados.
      </p>

      <Card>
        <CardContent className="space-y-3">
          <CardTitle>Email con PDF</CardTitle>
          <Label htmlFor="destination-emails">Destinatarios (hasta 10, separados por comas)</Label>
          <Input
            id="destination-emails"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="admin@empresa.com, jefe@empresa.com"
          />
          <div className="flex items-center gap-2">
            <Button onClick={saveEmail} disabled={pending}>
              Guardar email
            </Button>
            {email ? (
              <Button variant="outline" onClick={() => remove("email")} disabled={pending}>
                Quitar
              </Button>
            ) : null}
            {emailMessage ? <span data-testid="email-message" className="text-sm">{emailMessage}</span> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <CardTitle>Webhook firmado</CardTitle>
          <Label htmlFor="destination-url">URL (http o https)</Label>
          <Input
            id="destination-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/hook"
          />
          <div className="flex items-center gap-2">
            <Button onClick={saveWebhook} disabled={pending}>
              Guardar webhook
            </Button>
            {webhook ? (
              <>
                <Button variant="outline" onClick={regenerate} disabled={pending}>
                  Regenerar secreto
                </Button>
                <Button variant="outline" onClick={() => remove("webhook")} disabled={pending}>
                  Quitar
                </Button>
              </>
            ) : null}
            {webhookMessage ? (
              <span data-testid="webhook-message" className="text-sm">
                {webhookMessage}
              </span>
            ) : null}
          </div>
          {secret ? (
            <div className="rounded-lg border p-3 text-sm" data-testid="webhook-secret">
              <p>Copia este secreto ahora: no se volverá a mostrar.</p>
              <code className="break-all">{secret}</code>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Si la aplicación se reinicia, los envíos pendientes se reanudan al arrancar. Mientras no haya
        un proceso en marcha, no se hacen reintentos.
      </p>
    </div>
  );
}
