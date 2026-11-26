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
  AUTH_SECRET: "a".repeat(32),
  AUTH_URL: "http://localhost:3000",
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  SMTP_FROM: "no-reply@formia.local",
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
      STORAGE_MAX_UPLOAD_BYTES: 10485760,
      STORAGE_SIGNED_URL_TTL_SECONDS: 900,
      AUTH_SECRET: "a".repeat(32),
      AUTH_URL: "http://localhost:3000",
      SMTP_HOST: "localhost",
      SMTP_PORT: 1025,
      SMTP_FROM: "no-reply@formia.local",
      SMTP_USER: undefined,
      SMTP_PASSWORD: undefined,
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

  // Cubre: RNF-AUT-02 (ningún secreto en el mensaje de error)
  it("lanza un error cuando AUTH_SECRET tiene menos de 32 caracteres", () => {
    const invalid = { ...validEnv, AUTH_SECRET: "demasiado-corto" };

    expect(() => loadEnv(invalid)).toThrowError(/AUTH_SECRET/);
  });

  it("aplica los valores por defecto cuando no se indican", () => {
    const rest = withoutKeys(validEnv, [
      "NODE_ENV",
      "PORT",
      "S3_REGION",
      "S3_FORCE_PATH_STYLE",
      "AUTH_URL",
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_FROM",
    ]);

    const env = loadEnv(rest);

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
    expect(env.S3_REGION).toBe("eu-west-1");
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.AUTH_URL).toBe("http://localhost:3000");
    expect(env.SMTP_HOST).toBe("localhost");
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.SMTP_FROM).toBe("no-reply@formia.local");
  });

  // Cubre: RNF-STO-03, RF-STO-04
  it("STORAGE_MAX_UPLOAD_BYTES vale 10485760 por defecto y acepta otro valor", () => {
    expect(loadEnv(validEnv).STORAGE_MAX_UPLOAD_BYTES).toBe(10485760);
    expect(
      loadEnv({ ...validEnv, STORAGE_MAX_UPLOAD_BYTES: "2048" }).STORAGE_MAX_UPLOAD_BYTES,
    ).toBe(2048);
  });

  // Cubre: RF-STO-02
  it("STORAGE_SIGNED_URL_TTL_SECONDS rechaza 901 y acepta 900", () => {
    expect(() => loadEnv({ ...validEnv, STORAGE_SIGNED_URL_TTL_SECONDS: "901" })).toThrowError(
      /STORAGE_SIGNED_URL_TTL_SECONDS/,
    );
    expect(
      loadEnv({ ...validEnv, STORAGE_SIGNED_URL_TTL_SECONDS: "900" })
        .STORAGE_SIGNED_URL_TTL_SECONDS,
    ).toBe(900);
  });

  // Cubre: RNF-STO-03
  it("S3_PUBLIC_ENDPOINT es opcional y debe ser una URL", () => {
    expect(loadEnv(validEnv).S3_PUBLIC_ENDPOINT).toBeUndefined();
    expect(
      loadEnv({ ...validEnv, S3_PUBLIC_ENDPOINT: "https://files.example.com" })
        .S3_PUBLIC_ENDPOINT,
    ).toBe("https://files.example.com");
    expect(() => loadEnv({ ...validEnv, S3_PUBLIC_ENDPOINT: "no-es-url" })).toThrowError(
      /S3_PUBLIC_ENDPOINT/,
    );
  });
});
