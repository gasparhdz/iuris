import crypto from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "./index.js";
import { securityAudit } from "./schema.js";
import {
  computeSecurityAuditRowHash,
  SecurityAuditService,
  verifyAuditChainRows,
  type SecurityAuditHashInput,
} from "../services/security-audit.service.js";
import { env } from "../env.js";

function parseConcurrencyArg() {
  const arg = process.argv.find((value) => value.startsWith("--concurrency="));
  if (!arg) return 0;

  const value = Number(arg.split("=")[1]);
  if (!Number.isInteger(value) || value < 1 || value > 500) {
    throw new Error("--concurrency debe ser un entero entre 1 y 500");
  }

  return value;
}

function toHashInput(row: typeof securityAudit.$inferSelect): SecurityAuditHashInput {
  return {
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
  };
}

async function verifyChain() {
  const rows = await db.select().from(securityAudit).orderBy(asc(securityAudit.id));
  return verifyAuditChainRows(rows);
}

/**
 * Re-encadena todos los registros existentes con el algoritmo vigente (HMAC + serializacion
 * canonica). Necesario una sola vez al migrar desde el SHA-256 plano: recomputa previousHash
 * y rowHash en orden de id preservando los datos. Idempotente.
 */
async function rekeyChain() {
  const rows = await db.select().from(securityAudit).orderBy(asc(securityAudit.id));
  let updated = 0;

  // La tabla es append-only por un trigger (security_audit_append_only). El re-encadenado es
  // una migracion controlada: se deshabilita el trigger SOLO dentro de esta transaccion; si
  // algo falla, el rollback revierte tambien el disable. Solo puede ejecutarlo quien posee la
  // AUDIT_HMAC_KEY, asi que no debilita la garantia de la cadena.
  await db.transaction(async (tx) => {
    await tx.execute(sql`ALTER TABLE "security_audit" DISABLE TRIGGER "security_audit_append_only"`);

    let previousHash: string | null = null;
    for (const row of rows) {
      const rowHash = computeSecurityAuditRowHash({ ...toHashInput(row), previousHash });
      if (row.previousHash !== previousHash || row.rowHash !== rowHash) {
        await tx.update(securityAudit).set({ previousHash, rowHash }).where(eq(securityAudit.id, row.id));
        updated++;
      }
      previousHash = rowHash;
    }

    await tx.execute(sql`ALTER TABLE "security_audit" ENABLE TRIGGER "security_audit_append_only"`);
  });

  return { total: rows.length, updated };
}

async function runConcurrencySimulation(count: number) {
  if (env.NODE_ENV === "production") {
    throw new Error("La prueba de concurrencia no se ejecuta en production porque inserta eventos de auditoria.");
  }

  const runId = crypto.randomUUID();
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecurityAuditService.log({
        evento: "ADMIN_ACTION",
        estudioId: 0,
        usuarioId: null,
        metodo: "TEST",
        path: "/security-audit/concurrency-test",
        ip: "127.0.0.1",
        userAgent: "security-audit-chain-verifier",
        metadata: {
          chainVerifier: true,
          runId,
          index,
        },
      }),
    ),
  );

  return runId;
}

async function main() {
  if (process.argv.includes("--rekey")) {
    const result = await rekeyChain();
    console.log(`security_audit re-encadenado con HMAC: ${result.updated}/${result.total} filas actualizadas.`);
  }

  const concurrency = parseConcurrencyArg();
  if (concurrency > 0) {
    const runId = await runConcurrencySimulation(concurrency);
    console.log(`Prueba de concurrencia insertada: eventos=${concurrency} runId=${runId}`);
  }

  const result = await verifyChain();
  if (result.failures.length === 0) {
    console.log(`security_audit OK: ${result.rowsChecked} filas verificadas, cadena lineal.`);
    return;
  }

  console.error(`security_audit FALLA: ${result.failures.length} inconsistencias en ${result.rowsChecked} filas.`);
  for (const failure of result.failures.slice(0, 20)) {
    console.error(
      `id=${failure.id} reason=${failure.reason} expected=${failure.expected ?? "null"} actual=${failure.actual ?? "null"}`,
    );
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("No se pudo verificar security_audit", error);
  process.exitCode = 1;
});
