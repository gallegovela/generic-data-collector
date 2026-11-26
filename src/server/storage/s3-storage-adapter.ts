import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageAdapter } from "./storage-adapter";

const MAX_TTL_SECONDS = 900;

export type S3StorageConfig = {
  endpoint: string;
  publicEndpoint?: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  forcePathStyle: boolean;
};

/**
 * Implementación S3 (MinIO, S3 o Azure Blob en modo S3). Dos clientes: uno
 * para operar con `endpoint` y otro solo para firmar con el host que ve el
 * navegador. Sin ACL: el bucket nunca es público.
 *
 * Cubre: RF-STO-02, RNF-STO-01, RNF-STO-03.
 */
export function createS3StorageAdapter(config: S3StorageConfig): StorageAdapter {
  const base = {
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
  };
  const client = new S3Client({ ...base, endpoint: config.endpoint });
  const signer = new S3Client({ ...base, endpoint: config.publicEndpoint ?? config.endpoint });

  return {
    async put({ key, body, contentType }) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },
    async getSignedUrl(key, expiresInSeconds) {
      if (expiresInSeconds > MAX_TTL_SECONDS) {
        throw new Error("La URL firmada no puede durar más de 900 segundos.");
      }
      return getSignedUrl(signer, new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
        expiresIn: expiresInSeconds,
      });
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
        return true;
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        if (status === 404) return false;
        throw error;
      }
    },
  };
}
