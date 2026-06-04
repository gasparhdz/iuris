import crypto from "node:crypto";
import type { FastifyBaseLogger, FastifyRequest } from "fastify";
import { desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { securityAudit } from "../db/schema.js";

export type SecurityAuditEvent =
  | "LOGIN_OK"
  | "LOGIN_FAIL"
  | "LOGOUT"
  | "TOKEN_REFRESH"
  | "TOKEN_REUSE"
  | "PASSWORD_CHANGE"
  | "PASSWORD_RESET"
  | "ROLE_CHANGE"
  | "USER_CREATE"
  | "USER_DISABLE"
  | "ACCESS_DENIED"
  | "ADMIN_ACTION"
  | "SISFE_CONNECT"
  | "SISFE_SYNC"
  | "PERMISSION_CHANGE";

type SecurityAuditInput = {
  evento: SecurityAuditEvent;
  estudioId?: number | null;
  usuarioId?: number | null;
  targetEstudioId?: number | null;
  statusCode?: number | null;
  metadata?: Record<string, unknown> | null;
  metodo?: string | null;
  path?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  request?: FastifyRequest;
  logger?: FastifyBaseLogger;
};

export type SecurityAuditHashInput = {
  estudioId: number;
  usuarioId: number | null;
  evento: string;
  metodo: string | null;
  path: string | null;
  ip: string | null;
  userAgent: string | null;
  statusCode: number | null;
  targetEstudioId: number | null;
  metadata: unknown;
  previousHash: string | null;
};

const SECURITY_AUDIT_CHAIN_LOCK_CLASS = 714445;
const SECURITY_AUDIT_CHAIN_LOCK_KEY = 202602;

const SENSITIVE_METADATA_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "cookie",
  "cookieValue",
  "currentUser",
  "sessionCookieEncriptada",
  "email",
  "dni",
  "cuit",
  "nombre",
  "apellido",
  "caratula",
  "descripcion",
  "observacion",
  "novedad",
]);

export class SecurityAuditService {
  static async log(input: SecurityAuditInput): Promise<void> {
    const request = input.request;
    const logger = input.logger ?? request?.log;
    const row = {
      estudioId: input.estudioId ?? request?.authUser?.estudioId ?? 0,
      usuarioId: input.usuarioId ?? request?.authUser?.id ?? null,
      evento: input.evento,
      metodo: input.metodo ?? request?.method ?? null,
      path: input.path ?? (request ? sanitizePath(request.url) : null),
      ip: input.ip ?? request?.ip ?? null,
      userAgent: input.userAgent ?? normalizeHeader(request?.headers["user-agent"]),
      statusCode: input.statusCode ?? null,
      targetEstudioId: input.targetEstudioId ?? null,
      metadata: sanitizeMetadata(input.metadata ?? null),
    };

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${SECURITY_AUDIT_CHAIN_LOCK_CLASS}, ${SECURITY_AUDIT_CHAIN_LOCK_KEY})`);

          const [previous] = await tx
            .select({ rowHash: securityAudit.rowHash })
            .from(securityAudit)
            .orderBy(desc(securityAudit.id))
            .limit(1);
          const previousHash = previous?.rowHash ?? null;
          const rowHash = computeSecurityAuditRowHash({ ...row, previousHash });

          await tx.insert(securityAudit).values({
            ...row,
            previousHash,
            rowHash,
          });
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }

    logger?.fatal?.({ err: lastError, evento: input.evento }, "Fallo critico al registrar auditoria de seguridad");
    if (!logger?.fatal) {
      logger?.error?.({ err: lastError, evento: input.evento }, "Fallo critico al registrar auditoria de seguridad");
    }
  }
}

export function computeSecurityAuditRowHash(row: SecurityAuditHashInput) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(row))
    .digest("hex");
}

function sanitizePath(path: string) {
  try {
    const url = new URL(path, "http://iuris.local");
    return url.pathname;
  } catch {
    return path.split("?")[0] ?? path;
  }
}

function normalizeHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.join(", ").slice(0, 500);
  return value?.slice(0, 500) ?? null;
}

function sanitizeMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_METADATA_KEYS.has(key)) {
      output[key] = "[redacted]";
    } else if (typeof value === "string") {
      output[key] = value.slice(0, 200);
    } else {
      output[key] = value;
    }
  }
  return output;
}
