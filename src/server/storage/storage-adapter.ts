import { getEnv } from "@/lib/env";
import { createS3StorageAdapter } from "./s3-storage-adapter";

/**
 * Interfaz única de almacenamiento. Hoy hay una implementación S3 (MinIO
 * en local, Azure Blob en modo S3 solo cambiando variables) y otra en
 * memoria para tests.
 *
 * Cubre: RF-STO-02, RNF-STO-01, RNF-STO-03.
 */
export interface StorageAdapter {
  /** Guarda el objeto. Sobrescribir la misma clave con el mismo contenido es inocuo. */
  put(input: { key: string; body: Uint8Array; contentType: string }): Promise<void>;
  /** URL firmada GET (expiresInSeconds ≤ 900, si no lanza Error). */
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Contenido del objeto (solo servidor, nunca por URL pública). Lanza si no existe. */
  get(key: string): Promise<Uint8Array>;
}

let adapter: StorageAdapter | null = null;

/** Adaptador S3 (singleton perezoso desde `getEnv()`). */
export function getStorageAdapter(): StorageAdapter {
  if (!adapter) {
    const env = getEnv();
    adapter = createS3StorageAdapter({
      endpoint: env.S3_ENDPOINT,
      publicEndpoint: env.S3_PUBLIC_ENDPOINT,
      region: env.S3_REGION,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
      bucket: env.S3_BUCKET,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }
  return adapter;
}

export function setStorageAdapterForTests(next: StorageAdapter | null): void {
  adapter = next;
}
