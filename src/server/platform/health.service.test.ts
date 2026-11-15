import { describe, expect, it } from "vitest";
import { checkHealth } from "./health.service";

const ok = () => Promise.resolve(true);
const error = () => Promise.resolve(false);

describe("checkHealth", () => {
  // Cubre: CA-PLT-04
  it("devuelve status ok cuando la base de datos y el almacenamiento están accesibles", async () => {
    const result = await checkHealth(ok, ok);

    expect(result).toEqual({
      status: "ok",
      checks: { database: "ok", storage: "ok" },
    });
  });

  // Cubre: CA-PLT-04
  it("devuelve status error marcando solo la base de datos cuando falla", async () => {
    const result = await checkHealth(error, ok);

    expect(result).toEqual({
      status: "error",
      checks: { database: "error", storage: "ok" },
    });
  });

  // Cubre: CA-PLT-04
  it("devuelve status error marcando solo el almacenamiento cuando falla", async () => {
    const result = await checkHealth(ok, error);

    expect(result).toEqual({
      status: "error",
      checks: { database: "ok", storage: "error" },
    });
  });

  it("devuelve status error marcando ambos cuando los dos fallan", async () => {
    const result = await checkHealth(error, error);

    expect(result).toEqual({
      status: "error",
      checks: { database: "error", storage: "error" },
    });
  });
});
