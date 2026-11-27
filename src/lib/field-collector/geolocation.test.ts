import { describe, expect, it } from "vitest";
import { geolocationErrorMessage, toGpsAnswer } from "./geolocation";

describe("geolocation", () => {
  it("toGpsAnswer convierte la posición", () => {
    const answer = toGpsAnswer({
      coords: { latitude: 40.4, longitude: -3.7, accuracy: 12 },
      timestamp: Date.UTC(2026, 10, 26, 10, 0, 0),
    });
    expect(answer).toEqual({
      lat: 40.4,
      lng: -3.7,
      accuracy: 12,
      capturedAt: "2026-11-26T10:00:00.000Z",
    });
  });

  it("geolocationErrorMessage distingue los códigos", () => {
    expect(geolocationErrorMessage(1)).toBe("No se pudo obtener la ubicación: permiso denegado");
    expect(geolocationErrorMessage(2)).toContain("posición no disponible");
    expect(geolocationErrorMessage(3)).toContain("tiempo");
    expect(geolocationErrorMessage(99)).toBe("No se pudo obtener la ubicación");
  });
});
