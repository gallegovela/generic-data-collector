import { z } from "zod";

/**
 * Esquema de las variables de entorno de este módulo. Cada módulo
 * posterior (tenancy-auth, outputs, ai-assistant...) añade aquí las
 * suyas cuando se diseñe, junto con su entrada en `.env.example`.
 *
 * Cubre: RF-PLT-03, RF-PLT-04, CA-PLT-03.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith("postgresql://"), {
      message: "debe ser una URL postgresql://...",
    }),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("eu-west-1"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  // file-storage (#25): host con el que se firman las URLs que abre el
  // navegador (por defecto, S3_ENDPOINT), tamaño máximo de subida y vida
  // de la URL firmada (máximo 900 s, RF-STO-02).
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  STORAGE_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10485760),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(1).max(900).default(900),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().default("http://localhost:3000"),
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_FROM: z.string().email().default("no-reply@formia.local"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida `source` contra `envSchema`. Lanza un `Error` con un mensaje
 * que incluye el nombre y el motivo de cada variable inválida o
 * ausente. Nunca incluye el valor de ninguna variable en el mensaje
 * (ver "Seguridad y privacidad" en specs/platform/design.md).
 *
 * El tipo del parámetro es un diccionario de cadenas en lugar de
 * `NodeJS.ProcessEnv`: Next.js aumenta esa interfaz para exigir
 * `NODE_ENV`, lo que impediría probar aquí mismo que `loadEnv` lo
 * rellena con su valor por defecto cuando falta.
 */
export function loadEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");

    throw new Error(`Variables de entorno inválidas: ${details}`);
  }

  return result.data;
}

let cachedEnv: Env | undefined;

/**
 * Devuelve el resultado cacheado de `loadEnv(process.env)`; solo lo
 * calcula la primera vez que se llama en el proceso.
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = loadEnv(process.env);
  }

  return cachedEnv;
}
