import { describe, expect, it } from "vitest";
import {
  assertMismoDeudor,
  honorarioDeudorEsCliente,
  resolveHonorarioDeudor,
} from "../services/honorario-deudor.js";
import { buildCuentaCorriente, type CCHonorario } from "../services/cuenta-corriente.js";
import { imputarIngreso, ordenarPrelacion, type DeudaImputable } from "../services/imputacion.js";
import { pesos } from "../utils/decimal.js";

const VJ = "132863.1800";

function honorarioBase(overrides: Partial<CCHonorario>): CCHonorario {
  return {
    id: 1,
    descripcion: "Honorario",
    fechaRegulacion: new Date("2026-04-10T00:00:00.000Z"),
    fechaVencimiento: null,
    jus: null,
    montoPesos: null,
    valorJusRef: null,
    politicaCodigo: null,
    monedaCodigo: "ARS",
    tasaInteresMensualPct: null,
    plan: null,
    aplicaciones: [],
    ...overrides,
  };
}

describe("planes: mismo deudor", () => {
  it("permite un plan cuyo deudor es un tercero", () => {
    const deudor = assertMismoDeudor([{
      clienteId: 10,
      obligadoClienteId: null,
      obligadoTerceroId: 55,
    }]);
    expect(deudor).toEqual({ tipo: "tercero", id: 55 });
  });

  it("permite varios honorarios del mismo tercero en un cobro", () => {
    const deudor = assertMismoDeudor([
      { clienteId: 10, obligadoClienteId: null, obligadoTerceroId: 55 },
      { clienteId: 10, obligadoClienteId: null, obligadoTerceroId: 55 },
    ]);
    expect(deudor).toEqual({ tipo: "tercero", id: 55 });
  });

  it("rechaza mezclar deudor cliente con deudor tercero (400 PLAN_DEUDORES_DISTINTOS)", () => {
    expect(() => assertMismoDeudor([
      { clienteId: 10, obligadoClienteId: 10, obligadoTerceroId: null },
      { clienteId: 10, obligadoClienteId: null, obligadoTerceroId: 55 },
    ])).toThrow("PLAN_DEUDORES_DISTINTOS");
  });

  it("rechaza mezclar dos terceros distintos", () => {
    expect(() => assertMismoDeudor([
      { clienteId: 10, obligadoClienteId: null, obligadoTerceroId: 55 },
      { clienteId: 10, obligadoClienteId: null, obligadoTerceroId: 99 },
    ])).toThrow("PLAN_DEUDORES_DISTINTOS");
  });
});

describe("planes: imputación acotada al deudor (no contamina CC del cliente)", () => {
  it("cuotas de un plan de tercero se imputan entre sí sin tocar deudas del cliente", () => {
    // Simula un cobro aplicado solo a cuotas del plan del tercero.
    const deudasPlanTercero: DeudaImputable[] = [
      {
        id: "cuota:tercero-1",
        tipo: "CUOTA",
        vencimiento: new Date("2026-05-01T00:00:00.000Z"),
        interesPesos: pesos("0"),
        saldoPesos: pesos("30000"),
      },
      {
        id: "cuota:tercero-2",
        tipo: "CUOTA",
        vencimiento: new Date("2026-06-01T00:00:00.000Z"),
        interesPesos: pesos("0"),
        saldoPesos: pesos("30000"),
      },
    ];

    const resultado = imputarIngreso(
      pesos("40000"),
      ordenarPrelacion(deudasPlanTercero, new Date("2026-06-15T00:00:00.000Z")),
    );

    expect(resultado.movimientos.map((m) => m.deudaId)).toEqual([
      "cuota:tercero-1",
      "cuota:tercero-2",
    ]);
    expect(resultado.movimientos[0].aCapital.toPg()).toBe("30000.00");
    expect(resultado.movimientos[1].aCapital.toPg()).toBe("10000.00");
    expect(resultado.remanente.toPg()).toBe("0.00");
  });

  it("FIFO del cliente excluye honorarios con obligado tercero (no contamina CC)", () => {
    const delCliente = honorarioBase({
      id: 1,
      montoPesos: "100000.00",
      monedaCodigo: "ARS",
    });
    const delTercero = honorarioBase({
      id: 2,
      montoPesos: "500000.00",
      monedaCodigo: "ARS",
    });

    // Misma lógica que el FIFO de planes.service (solo deudor = cliente).
    const honorariosFifoCliente = [
      { ...delCliente, clienteId: 10, obligadoClienteId: null, obligadoTerceroId: null },
      { ...delTercero, clienteId: 10, obligadoClienteId: null, obligadoTerceroId: 99 },
    ].filter((h) => honorarioDeudorEsCliente(h, 10));

    expect(honorariosFifoCliente.map((h) => h.id)).toEqual([1]);
    expect(resolveHonorarioDeudor({
      clienteId: 10,
      obligadoClienteId: null,
      obligadoTerceroId: 99,
    })).toEqual({ tipo: "tercero", id: 99 });

    const ccCliente = buildCuentaCorriente({
      fechaCorte: new Date("2026-06-09T00:00:00.000Z"),
      valorJusActual: VJ,
      honorarios: honorariosFifoCliente,
      gastos: [],
      ingresos: [],
    });

    expect(ccCliente.totales.saldoPesos).toBe(100000);
  });
});
