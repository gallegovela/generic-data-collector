import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createS3StorageAdapter } from "./s3-storage-adapter";

// Requiere MinIO real (npm run test:stack:run -- env STORAGE_INTEGRATION=1 npx vitest run ...).
// Cubre: CA-STO-01, RNF-STO-01, RNF-STO-03.

const enabled = process.env.STORAGE_INTEGRATION === "1";
const bucket = process.env.S3_BUCKET ?? "formia";
const endpoint = process.env.S3_ENDPOINT ?? "http://minio:9000";

describe.skipIf(!enabled)("s3-storage-adapter (MinIO)", () => {
  const adapter = createS3StorageAdapter({
    endpoint,
    region: process.env.S3_REGION ?? "eu-west-1",
    accessKey: process.env.S3_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.S3_SECRET_KEY ?? "minioadmin",
    bucket,
    forcePathStyle: true,
  });
  const keys: string[] = [];
  const body = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

  async function upload(): Promise<string> {
    const key = `org/it-test/photo/${randomUUID()}.jpg`;
    keys.push(key);
    await adapter.put({ key, body, contentType: "image/jpeg" });
    return key;
  }

  afterAll(async () => {
    for (const key of keys) await adapter.delete(key);
  });

  it("la URL firmada expired da 403 pasado su tiempo de vida", async () => {
    const key = await upload();
    const url = await adapter.getSignedUrl(key, 1);
    expect((await fetch(url)).status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect((await fetch(url)).status).toBe(403);
  });

  it("rechaza (Error) una vida de más de 900 s", async () => {
    await expect(adapter.getSignedUrl("org/x/photo/y.jpg", 901)).rejects.toThrow();
  });

  it("el bucket es privado: sin firma da 403 y con firma 200", async () => {
    const key = await upload();
    expect((await fetch(`${endpoint}/${bucket}/${key}`)).status).toBe(403);
    const signed = await fetch(await adapter.getSignedUrl(key, 60));
    expect(signed.status).toBe(200);
    expect(new Uint8Array(await signed.arrayBuffer())).toEqual(body);
  });

  it("exists y delete funcionan", async () => {
    const key = await upload();
    expect(await adapter.exists(key)).toBe(true);
    await adapter.delete(key);
    expect(await adapter.exists(key)).toBe(false);
  });
});
