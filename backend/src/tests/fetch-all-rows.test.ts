import { describe, expect, it, vi } from "vitest";
import { buildCuentaCorriente, type CCHonorario } from "../services/cuenta-corriente.js";
import { fetchAllRows } from "../utils/fetch-all-rows.js";

const VJ = "132863.1800";

function honorarioArs(id: number, monto: string): CCHonorario {
  return {
    id,
    descripcion: `Honorario ${id}`,
    fechaRegulacion: new Date("2026-04-10T00:00:00.000Z"),
    fechaVencimiento: null,
    jus: null,
    montoPesos: monto,
    valorJusRef: null,
    politicaCodigo: null,
    monedaCodigo: "ARS",
    tasaInteresMensualPct: null,
    plan: null,
    aplicaciones: [],
  };
}

describe("fetchAllRows", () => {
  it("itera en lotes hasta agotar todos los resultados", async () => {
    const rows = [1, 2, 3, 4, 5];
    const calls: Array<{ limit: number; offset: number }> = [];

    const result = await fetchAllRows(async ({ limit, offset }) => {
      calls.push({ limit, offset });
      return { data: rows.slice(offset, offset + limit) };
    }, 2);

    expect(result).toEqual([1, 2, 3, 4, 5]);
    expect(calls).toEqual([
      { limit: 2, offset: 0 },
      { limit: 2, offset: 2 },
      { limit: 2, offset: 4 },
    ]);
  });

  it("acepta queryFn que devuelve array directo", async () => {
    const result = await fetchAllRows(async ({ limit, offset }) => {
      return ["a", "b", "c"].slice(offset, offset + limit);
    }, 2);
    expect(result).toEqual(["a", "b", "c"]);
  });
});

describe("cuenta corriente: carga completa sin tope (batch < total)", () => {
  it("resumen con 5 honorarios y batchSize=2 suma todos los totales", async () => {
    const honorariosDb = [
      honorarioArs(1, "1000.00"),
      honorarioArs(2, "2000.00"),
      honorarioArs(3, "3000.00"),
      honorarioArs(4, "4000.00"),
      honorarioArs(5, "5000.00"),
    ];

    const queryFn = vi.fn(async ({ limit, offset }: { limit: number; offset: number }) => ({
      data: honorariosDb.slice(offset, offset + limit),
      count: honorariosDb.length,
    }));

    // Mismo patrón que loadDatos / orden por saldo: leer el conjunto completo en lotes.
    const honorarios = await fetchAllRows(queryFn, 2);

    expect(queryFn).toHaveBeenCalledTimes(3);
    expect(honorarios).toHaveLength(5);

    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-06-09T00:00:00.000Z"),
      valorJusActual: VJ,
      honorarios,
      gastos: [],
      ingresos: [],
    });

    // 1000+2000+3000+4000+5000 — sin truncar al tamaño del batch.
    expect(result.totales.honorariosPesos).toBe(15000);
    expect(result.totales.saldoPesos).toBe(15000);
  });
});
