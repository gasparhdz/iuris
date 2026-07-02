import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config();

function isBase64Encoded32Bytes(value: string) {
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(10),
  ENCRYPTION_KEY: z.string().refine(isBase64Encoded32Bytes, {
    message: "ENCRYPTION_KEY debe ser una clave aleatoria de 32 bytes codificada en base64",
  }),
  AUDIT_HMAC_KEY: z.string().refine(isBase64Encoded32Bytes, {
    message: "AUDIT_HMAC_KEY debe ser una clave aleatoria de 32 bytes codificada en base64",
  }),
  ENCRYPTION_KEY_LEGACY: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  DRIVE_ROOT_FOLDER_ID: z.string().optional(),
  STORAGE_DRIVER: z.enum(["google-drive", "s3"]).default("google-drive"),
  STORAGE_CONCURRENCY: z.coerce.number().int().positive().default(4),
  STORAGE_INTERVAL_CAP: z.coerce.number().int().positive().default(8),
  STORAGE_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  STORAGE_WEBHOOK_SECRET: z.string().optional(),
  STORAGE_WEBHOOK_BASE_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  APP_URL: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().default(6379),
  SISFE_CONCURRENCY: z.coerce.number().int().positive().default(2),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === "production" && !env.CORS_ORIGIN?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["CORS_ORIGIN"],
      message: "CORS_ORIGIN es requerido en produccion",
    });
  }
  if (env.STORAGE_DRIVER === "s3") {
    for (const key of ["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
      if (!env[key]?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${key} es requerido cuando STORAGE_DRIVER=s3`,
        });
      }
    }
  }
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  process.exit(1);
}

export const env = {
  ..._env.data,
  LOG_LEVEL: _env.data.LOG_LEVEL || (_env.data.NODE_ENV === "development" ? "debug" : "info"),
};
