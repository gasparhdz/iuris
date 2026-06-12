import type { FastifyBaseLogger, FastifyRequest } from "fastify";
import { desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { securityAudit } from "../db/schema.js";
import {
  computeSecurityAuditRowHash,
  verifyAuditChainRows,
  type ChainVerificationFailure,
  type SecurityAuditHashInput,
  type SecurityAuditPersistedRow,
} from "./security-audit-chain.js";

// La lógica pura de hash/cadena vive en ./security-audit-chain (sin dependencias de DB/env,
// testeable). Se re-exporta para no romper a los consumidores que la importan desde acá.
export {
  computeSecurityAuditRowHash,
  verifyAuditChainRows,
  type ChainVerificationFailure,
  type SecurityAuditHashInput,
  type SecurityAuditPersistedRow,
};

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

type ResolvedAuditRow = {
  estudioId: number;
  usuarioId: number | null;
  evento: SecurityAuditEvent;
  metodo: string | null;
  path: string | null;
  ip: string | null;
  userAgent: string | null;
  statusCode: number | null;
  targetEstudioId: number | null;
  metadata: Record<string, unknown> | null;
};

// Buffer en memoria para desacoplar la escritura de auditoria del ciclo del request.
// Eventos de alto volumen ligados al request (ACCESS_DENIED en cada 401/403, ADMIN_ACTION en
// cada /admin) se ENCOLAN (enqueue) y un drainer en background los persiste, en vez de hacer
// que cada request espere una transaccion con advisory lock global. Asi un flood de 401s no
// amplifica el DoS bloqueando el hot path.
//
// El cap del buffer es la valvula anti-DoS: bajo un flood preferimos descartar eventos de
// auditoria (con aviso) antes que crecer la memoria sin limite. Los eventos criticos de
// seguridad (login, cambios de rol, acciones admin explicitas) siguen usando `log` (durable,
// awaited), no el buffer.
const MAX_BUFFER = 10_000;
const buffer: { row: ResolvedAuditRow; logger?: FastifyBaseLogger }[] = [];
let draining = false;
let droppedCount = 0;

function scheduleDrain() {
  if (draining) return;
  draining = true;
  setImmediate(() => { void drainLoop(); });
}

async function drainLoop() {
  try {
    while (buffer.length > 0) {
      const item = buffer.shift()!;
      await writeAuditRow(item.row, item.logger);
    }
  } finally {
    draining = false;
    if (buffer.length > 0) scheduleDrain();
  }
}

function resolveAuditRow(input: SecurityAuditInput): ResolvedAuditRow {
  const request = input.request;
  return {
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
}

async function writeAuditRow(row: ResolvedAuditRow, logger?: FastifyBaseLogger): Promise<void> {
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

  logger?.fatal?.({ err: lastError, evento: row.evento }, "Fallo critico al registrar auditoria de seguridad");
  if (!logger?.fatal) {
    logger?.error?.({ err: lastError, evento: row.evento }, "Fallo critico al registrar auditoria de seguridad");
  }
}

export class SecurityAuditService {
  /**
   * Escritura DURABLE y awaited. Usar para eventos criticos de seguridad (login, cambios de
   * rol/permisos, acciones admin explicitas) donde queremos confirmar la persistencia antes
   * de responder.
   */
  static async log(input: SecurityAuditInput): Promise<void> {
    await writeAuditRow(resolveAuditRow(input), input.logger ?? input.request?.log);
  }

  /**
   * Escritura NO bloqueante: resuelve los campos del request en el acto (porque Fastify puede
   * reciclar el objeto request despues del hook) y encola para que un drainer en background lo
   * persista. Usar en el hot path (hook onResponse) para no acoplar la auditoria al request.
   */
  static enqueue(input: SecurityAuditInput): void {
    const logger = input.logger ?? input.request?.log;
    if (buffer.length >= MAX_BUFFER) {
      droppedCount++;
      if (droppedCount % 1000 === 1) {
        logger?.warn?.({ droppedCount }, "Buffer de auditoria de seguridad lleno: descartando eventos");
      }
      return;
    }
    buffer.push({ row: resolveAuditRow(input), logger });
    scheduleDrain();
  }

  /** Vacia el buffer pendiente. Llamar en el cierre ordenado para no perder eventos encolados. */
  static async flush(): Promise<void> {
    while (buffer.length > 0) {
      const item = buffer.shift()!;
      await writeAuditRow(item.row, item.logger);
    }
  }
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
