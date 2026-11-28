"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { retryDeliveryAction } from "@/server/outputs/destination.actions";
import type { DeliveryView } from "@/server/outputs/delivery.service";

const STATUS_LABEL: Record<DeliveryView["status"], string> = {
  pending: "Pendiente",
  sending: "Enviando",
  sent: "Enviado",
  failed: "Fallido",
};

const KIND_LABEL: Record<DeliveryView["kind"], string> = { email: "Email", webhook: "Webhook" };

/** Historial de envíos y reenvío manual de uno fallido. Cubre: RF-OUT-10 */
export function DeliveryHistory({ formId, deliveries }: { formId: string; deliveries: DeliveryView[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function retry(id: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await retryDeliveryAction(formId, id);
      setMessage(result.ok ? "Reenvío iniciado." : result.error);
    });
  }

  if (deliveries.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay envíos.</p>;
  }

  return (
    <div className="space-y-2" data-testid="delivery-history">
      {message ? <p className="text-sm">{message}</p> : null}
      <ul className="divide-y rounded-lg border">
        {deliveries.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div>
              <span className="font-medium">{KIND_LABEL[d.kind]}</span> · {STATUS_LABEL[d.status]} ·{" "}
              {d.attempts} intento(s) · {d.createdAt.toLocaleString("es-ES")}
              {d.lastError ? <span className="text-muted-foreground"> · {d.lastError}</span> : null}
              {d.nextAttemptAt ? (
                <span className="text-muted-foreground">
                  {" "}
                  · próximo: {d.nextAttemptAt.toLocaleString("es-ES")}
                </span>
              ) : null}
            </div>
            {d.status === "failed" ? (
              <Button size="sm" variant="outline" onClick={() => retry(d.id)} disabled={pending}>
                Reenviar
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
