"use client";

import "leaflet/dist/leaflet.css";
import { useSyncExternalStore } from "react";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";

/** Mapa de un punto GPS (OpenStreetMap). Solo se monta en el cliente. Cubre: CA-SUB-03 */
export function SubmissionMap({ lat, lng, accuracy }: { lat: number; lng: number; accuracy: number }) {
  // false en el servidor, true en el cliente: Leaflet necesita `window`.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div data-testid="submission-map" className="h-56 w-full overflow-hidden rounded-lg border">
      {mounted ? (
        <MapContainer center={[lat, lng]} zoom={16} scrollWheelZoom={false} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CircleMarker center={[lat, lng]} radius={9} pathOptions={{ color: "#dc2626", fillOpacity: 0.8 }} />
        </MapContainer>
      ) : null}
      <span className="sr-only">
        Ubicación: {lat.toFixed(5)}, {lng.toFixed(5)} (precisión {Math.round(accuracy)} m)
      </span>
    </div>
  );
}
