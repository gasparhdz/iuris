import { describe, expect, it } from "vitest";
// Clave HMAC determinística para el test (32 bytes en base64). Debe setearse antes de que el
// módulo de cadena la lea (lazy). Importamos del módulo PURO (sin DB/env).
process.env.AUDIT_HMAC_KEY = Buffer.alloc(32, 7).toString("base64");
import {
  computeSecurityAuditRowHash,
  verifyAuditChainRows,
  type SecurityAuditPersistedRow,
} from "../services/security-audit-chain.js";

type RowData = Omit<SecurityAuditPersistedRow, "id" | "previousHash" | "rowHash">;

// Construye una cadena válida encadenando filas igual que el writer real: cada fila toma el
// rowHash de la anterior como previousHash y calcula su propio rowHash con la HMAC.
function buildChain(datas: RowData[]): SecurityAuditPersistedRow[] {
  const rows: SecurityAuditPersistedRow[] = [];
  let previousHash: string | null = null;
  datas.forEach((data, index) => {
    const base = { ...data, previousHash };
    const rowHash = computeSecurityAuditRowHash(base);
    rows.push({ ...base, id: index + 1, rowHash });
    previousHash = rowHash;
  });
  return rows;
}

function sampleData(overrides: Partial<RowData> = {}): RowData {
  return {
    estudioId: 1,
    usuarioId: 7,
    evento: "ACCESS_DENIED",
    metodo: "GET",
    path: "/api/v1/clientes",
    ip: "127.0.0.1",
    userAgent: "vitest",
    statusCode: 403,
    targetEstudioId: null,
    metadata: null,
    ...overrides,
  };
}

describe("security audit chain — tamper detection", () => {
  it("una cadena íntegra verifica sin fallas", () => {
    const rows = buildChain([
      sampleData({ evento: "LOGIN_OK", statusCode: 200 }),
      sampleData({ evento: "ACCESS_DENIED", statusCode: 403 }),
      sampleData({ evento: "ADMIN_ACTION", path: "/api/v1/admin/estudios", statusCode: 200 }),
    ]);

    const result = verifyAuditChainRows(rows);
    expect(result.rowsChecked).toBe(3);
    expect(result.failures).toHaveLength(0);
  });

  it("alterar un campo de una fila se detecta como row_hash_mismatch", () => {
    const rows = buildChain([sampleData(), sampleData({ statusCode: 403 }), sampleData()]);
    // Atacante cambia el statusCode de la fila 2 sin recomputar el hash (no tiene la HMAC key).
    rows[1] = { ...rows[1], statusCode: 200 };

    const result = verifyAuditChainRows(rows);
    const failure = result.failures.find((f) => f.id === 2);
    expect(failure?.reason).toBe("row_hash_mismatch");
  });

  it("alterar metadata (aunque sea un valor anidado) rompe el hash", () => {
    const rows = buildChain([
      sampleData({ metadata: { route: "/api/v1/honorarios" } }),
      sampleData({ metadata: { route: "/api/v1/gastos" } }),
    ]);
    rows[0] = { ...rows[0], metadata: { route: "/api/v1/admin" } };

    const result = verifyAuditChainRows(rows);
    expect(result.failures.some((f) => f.id === 1 && f.reason === "row_hash_mismatch")).toBe(true);
  });

  it("borrar una fila del medio rompe el enlace de la siguiente", () => {
    const rows = buildChain([sampleData(), sampleData(), sampleData()]);
    // Eliminar la fila 2: ahora la fila 3 apunta (previousHash) a un rowHash que ya no existe.
    const tampered = [rows[0], rows[2]];

    const result = verifyAuditChainRows(tampered);
    expect(result.failures.some((f) => f.id === 3 && f.reason === "previous_hash_mismatch")).toBe(true);
  });

  it("reordenar filas rompe el encadenamiento", () => {
    const rows = buildChain([sampleData(), sampleData(), sampleData()]);
    const reordered = [rows[0], rows[2], rows[1]];

    const result = verifyAuditChainRows(reordered);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it("reemplazar una fila por otra 'válida en sí misma' rompe el enlace con la anterior", () => {
    const rows = buildChain([sampleData(), sampleData()]);
    // Fila forjada con hash internamente consistente pero con previousHash que no enlaza.
    const forgedBase = { ...sampleData({ evento: "USER_DISABLE" }), previousHash: null };
    const forged: SecurityAuditPersistedRow = {
      ...forgedBase,
      id: 2,
      rowHash: computeSecurityAuditRowHash(forgedBase),
    };

    const result = verifyAuditChainRows([rows[0], forged]);
    // El rowHash recomputado coincide (no hay row_hash_mismatch) pero el previousHash no enlaza.
    expect(result.failures.some((f) => f.id === 2 && f.reason === "previous_hash_mismatch")).toBe(true);
    expect(result.failures.some((f) => f.reason === "row_hash_mismatch")).toBe(false);
  });

  it("la serialización canónica es independiente del orden de claves en metadata", () => {
    const a = computeSecurityAuditRowHash({ ...sampleData({ metadata: { a: 1, b: 2 } }), previousHash: null });
    const b = computeSecurityAuditRowHash({ ...sampleData({ metadata: { b: 2, a: 1 } }), previousHash: null });
    expect(a).toBe(b);
  });
});
