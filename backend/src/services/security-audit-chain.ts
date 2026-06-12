import crypto from "node:crypto";

/**
 * Lógica PURA de la cadena de auditoría de seguridad: hash encadenado (HMAC-SHA256) y
 * verificación. No importa la base ni el módulo `env` (que valida todo el entorno y hace
 * process.exit), para poder testear el tamper-detection sin DB ni entorno completo.
 *
 * La HMAC key se lee de forma perezosa de process.env.AUDIT_HMAC_KEY (memoizada). En runtime
 * es el mismo valor que valida env.ts; en tests basta con setear esa env var.
 */

let cachedKey: Buffer | null = null;
function getHmacKey(): Buffer {
  if (cachedKey === null) {
    cachedKey = Buffer.from(process.env.AUDIT_HMAC_KEY ?? "", "base64");
  }
  return cachedKey;
}

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

export type SecurityAuditPersistedRow = SecurityAuditHashInput & { id: number; rowHash: string };

export type ChainVerificationFailure = {
  id: number;
  reason: "previous_hash_mismatch" | "row_hash_mismatch";
  expected: string | null;
  actual: string | null;
};

/**
 * Hash encadenado de un registro de auditoria.
 *
 * Usa HMAC-SHA256 con una clave de servidor (AUDIT_HMAC_KEY) que NO se persiste en la base:
 * sin esa clave un atacante con acceso de escritura a la DB (DBA, SQLi, backup robado) no
 * puede recomputar la cadena para encubrir una alteracion. El SHA-256 plano anterior no daba
 * esa garantia porque hasheaba solo datos publicos.
 *
 * La entrada se serializa de forma canonica (claves ordenadas recursivamente, escape JSON)
 * para que el hash sea estable e independiente del orden de claves y a prueba de inyeccion
 * de separadores.
 */
export function computeSecurityAuditRowHash(row: SecurityAuditHashInput) {
  return crypto
    .createHmac("sha256", getHmacKey())
    .update(canonicalSerialize(row))
    .digest("hex");
}

/**
 * Verificación pura (sin DB) de la cadena de auditoría: recorre las filas en orden y comprueba
 * (a) que cada previousHash enlace con el rowHash anterior y (b) que cada rowHash recomputado
 * con la HMAC coincida. Cualquier alteración de un campo, reordenamiento o borrado de una fila
 * rompe alguno de los dos chequeos.
 */
export function verifyAuditChainRows(rows: SecurityAuditPersistedRow[]): { rowsChecked: number; failures: ChainVerificationFailure[] } {
  const failures: ChainVerificationFailure[] = [];
  let previousHash: string | null = null;

  for (const row of rows) {
    if (row.previousHash !== previousHash) {
      failures.push({ id: row.id, reason: "previous_hash_mismatch", expected: previousHash, actual: row.previousHash });
    }

    const recomputed = computeSecurityAuditRowHash({
      estudioId: row.estudioId,
      usuarioId: row.usuarioId,
      evento: row.evento,
      metodo: row.metodo,
      path: row.path,
      ip: row.ip,
      userAgent: row.userAgent,
      statusCode: row.statusCode,
      targetEstudioId: row.targetEstudioId,
      metadata: row.metadata,
      previousHash: row.previousHash,
    });
    if (row.rowHash !== recomputed) {
      failures.push({ id: row.id, reason: "row_hash_mismatch", expected: recomputed, actual: row.rowHash });
    }

    previousHash = row.rowHash;
  }

  return { rowsChecked: rows.length, failures };
}

function canonicalSerialize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalSerialize).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalSerialize((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}
