import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const validEnv = {
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "postgresql://formia:formia@localhost:5432/formia",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "eu-west-1",
  S3_ACCESS_KEY: "minioadmin",
  S3_SECRET_KEY: "minioadmin",
  S3_BUCKET: "formia",
  S3_FORCE_PATH_STYLE: "true",
} satisfies NodeJS.ProcessEnv;

function withoutKeys<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Omit<T, K> {
  const copy = { ...source };
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}

describe("loadEnv", () => {
  // Cubre: CA-PLT-03, RF-PLT-04
  it("devuelve el objeto Env esperado cuando todas las variables son válidas", () => {
    const env = loadEnv(validEnv);

    expect(env).toEqual({
      NODE_ENV: "test",
      PORT: 3000,
      DATABASE_URL: "postgresql://formia:formia@localhost:5432/formia",
      S3_ENDPOINT: "http://localhost:9000",
      S3_REGION: "eu-west-1",
      S3_ACCESS_KEY: "minioadmin",
      S3_SECRET_KEY: "minioadmin",
      S3_BUCKET: "formia",
      S3_FORCE_PATH_STYLE: true,
    });
  });

  // Cubre: CA-PLT-03, RF-PLT-03
  it("lanza un error que incluye el nombre de la variable ausente", () => {
    const rest = withoutKeys(validEnv, ["DATABASE_URL"]);

    expect(() => loadEnv(rest)).toThrowError(/DATABASE_URL/);
  });

  it("no incluye el valor de la variable inválida en el mensaje de error", () => {
    const invalid = { ...validEnv, DATABASE_URL: "mysql://secret-value" };

    expect(() => loadEnv(invalid)).toThrowError(/^(?!.*secret-value).*DATABASE_URL.*$/);
  });

  it("aplica los valores por defecto cuando no se indican", () => {
    const rest = withoutKeys(validEnv, [
      "NODE_ENV",
      "PORT",
      "S3_REGION",
      "S3_FORCE_PATH_STYLE",
    ]);

    const env = loadEnv(rest);

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
    expect(env.S3_REGION).toBe("eu-west-1");
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
  });
});
