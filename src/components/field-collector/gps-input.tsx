"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { geolocationErrorMessage, toGpsAnswer } from "@/lib/field-collector/geolocation";
import type { GpsAnswer } from "@/lib/form-schema";

/**
 * Captura de ubicación con `navigator.geolocation` (manual o automática).
 *
 * Cubre: RF-COL-11
 */
export function GpsInput({
  fieldId,
  value,
  onChange,
  autoCapture,
}: {
  fieldId: string;
  value: GpsAnswer | undefined;
  onChange: (value: GpsAnswer | undefined) => void;
  autoCapture?: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const autoDone = useRef(false);

  function capture() {
    if (!("geolocation" in navigator)) {
      setMessage("No se pudo obtener la ubicación: no disponible en este dispositivo");
      return;
    }
    setLoading(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoading(false);
        onChange(toGpsAnswer(position));
      },
      (error) => {
        setLoading(false);
        onChange(undefined);
        setMessage(geolocationErrorMessage(error.code));
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  useEffect(() => {
    if (!autoCapture || autoDone.current) return;
    autoDone.current = true;
    capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div id={`field-${fieldId}`} tabIndex={-1} className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full text-base"
        disabled={loading}
        onClick={capture}
      >
        {loading ? "Obteniendo ubicación…" : value ? "Actualizar ubicación" : "Obtener ubicación"}
      </Button>
      {value ? (
        <p data-testid={`gps-value-${fieldId}`} className="text-sm text-muted-foreground">
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)} (±{Math.round(value.accuracy)} m)
        </p>
      ) : null}
      {message ? (
        <p data-testid={`gps-message-${fieldId}`} className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
