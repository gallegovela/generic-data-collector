import { afterEach, describe, expect, it, vi } from "vitest";
import type { HealthCheckResult } from "@/server/platform/health.service";

const checkHealth = vi.fn<() => Promise<HealthCheckResult>>();

vi.mock("@/server/platform/health.service", () => ({
  checkHealth: () => checkHealth(),
}));

describe("GET /api/health", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  // Cubre: RF-PLT-08, CA-PLT-04
  it("responde 200 con el cuerpo de HealthCheckResult cuando todo está accesible", async () => {
    const result: HealthCheckResult = {
      status: "ok",
      checks: { database: "ok", storage: "ok" },
    };
    checkHealth.mockResolvedValue(result);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(result);
  });

  // Cubre: RF-PLT-08, CA-PLT-04
  it("responde 503 con el cuerpo de HealthCheckResult cuando una dependencia falla", async () => {
    const result: HealthCheckResult = {
      status: "error",
      checks: { database: "error", storage: "ok" },
    };
    checkHealth.mockResolvedValue(result);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(result);
  });
});
