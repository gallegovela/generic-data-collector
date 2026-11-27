import type { GpsAnswer } from "@/lib/form-schema";

type PositionLike = {
  coords: { latitude: number; longitude: number; accuracy: number };
  timestamp: number;
};

/** Convierte una posición del navegador en la respuesta de un campo GPS. */
export function toGpsAnswer(position: PositionLike): GpsAnswer {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    capturedAt: new Date(position.timestamp).toISOString(),
  };
}

/** Códigos de `GeolocationPositionError`: 1 permiso, 2 posición, 3 tiempo. */
export function geolocationErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return "No se pudo obtener la ubicación: permiso denegado";
    case 2:
      return "No se pudo obtener la ubicación: posición no disponible";
    case 3:
      return "No se pudo obtener la ubicación: se agotó el tiempo de espera";
    default:
      return "No se pudo obtener la ubicación";
  }
}
