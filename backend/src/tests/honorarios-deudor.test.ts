import { describe, expect, it } from "vitest";
import {
  atribuirMontosPorDeudor,
  decideDeudorUpdate,
  assertMismoDeudor,
} from "../services/honorario-deudor.js";
import { calcularSaldosHonorario, type CCHonorario } from "../services/cuenta-corriente.js";

describe("inmutabilidad del deudor (decideDeudorUpdate)", () => {
  const baseHonorario = {
    clienteId: 10,
    obligadoClienteId: 10,
    obligadoTerceroId: null as number | null,
  };

  it("1) con pagos imputados rechaza cualquier cambio de deudor/expediente", () => {
    expect(() => decideDeudorUpdate({
      fieldsChanging: true,
      hasPagosImputados: true,
      inPlan: false,
      honorariosDelPlan: [baseHonorario],
    })).toThrow("HONORARIO_DEUDOR_INMUTABLE");
  });

  it("2) en plan sin pagos permite cambio y pide sync del plan", () => {
    const decision = decideDeudorUpdate({
      fieldsChanging: true,
      hasPagosImputados: false,
      inPlan: true,
      honorariosDelPlan: [{
        clienteId: 10,
        obligadoClienteId: null,
        obligadoTerceroId: 55,
      }],
    });
    expect(decision).toBe("sync_plan");
  });

  it("2b) en plan sin pagos rechaza si rompe mismo deudor del plan", () => {
    expect(() => decideDeudorUpdate({
      fieldsChanging: true,
      hasPagosImputados: false,
      inPlan: true,
      honorariosDelPlan: [
        { clienteId: 10, obligadoClienteId: 10, obligadoTerceroId: null },
        { clienteId: 10, obligadoClienteId: null, obligadoTerceroId: 55 },
      ],
    })).toThrow("PLAN_DEUDORES_DISTINTOS");
  });

  it("3) sin pagos ni plan permite cambio libre", () => {
    const decision = decideDeudorUpdate({
      fieldsChanging: true,
      hasPagosImputados: false,
      inPlan: false,
      honorariosDelPlan: [{
        clienteId: 10,
        obligadoClienteId: null,
        obligadoTerceroId: 99,
      }],
    });
    expect(decision).toBe("allow");
  });

  it("4) sin cambio real de campos es noop (no valida pagos)", () => {
    expect(decideDeudorUpdate({
      fieldsChanging: false,
      hasPagosImputados: true,
      inPlan: true,
      honorariosDelPlan: [baseHonorario],
    })).toBe("noop");
  });
});

describe("ingresos mixtos: atribución por aplicación", () => {
  it("parte un ingreso entre honorario de tercero y gasto del cliente", () => {
    const atribuciones = atribuirMontosPorDeudor([
      {
        deudor: { tipo: "tercero", id: 55 },
        montoCapital: 80000,
        montoInteres: 0,
      },
      {
        deudor: { tipo: "cliente", id: 10 },
        montoCapital: 20000,
        montoInteres: 0,
      },
    ]);

    expect(atribuciones).toHaveLength(2);
    const tercero = atribuciones.find((a) => a.deudor.tipo === "tercero");
    const cliente = atribuciones.find((a) => a.deudor.tipo === "cliente");
    expect(tercero?.monto).toBe(80000);
    expect(cliente?.monto).toBe(20000);
  });

  it("assertMismoDeudor rechaza honorario de tercero + gasto del cliente", () => {
    expect(() => assertMismoDeudor([
      { clienteId: 10, obligadoClienteId: null, obligadoTerceroId: 55 },
      { clienteId: 10, obligadoClienteId: 10, obligadoTerceroId: null },
    ])).toThrow("PLAN_DEUDORES_DISTINTOS");
  });
});

describe("calcularSaldosHonorario (motor CC)", () => {
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

  it("incluye intereses devengados en saldoPesos", () => {
    const result = calcularSaldosHonorario(
      honorarioBase({
        montoPesos: "100000.00",
        fechaVencimiento: new Date("2026-01-01T00:00:00.000Z"),
        tasaInteresMensualPct: "10.00",
        politicaCodigo: "FECHA_REGULACION",
      }),
      VJ,
      new Date("2026-04-01T00:00:00.000Z"),
    );
    expect(result.interesPesos).toBeGreaterThan(0);
    expect(result.saldoPesos).toBe(result.saldoCapitalPesos + result.interesPesos);
  });

  it("JUS AL_COBRO revalúa capital sin mora", () => {
    const result = calcularSaldosHonorario(
      honorarioBase({
        jus: "4.0000",
        valorJusRef: "100000.0000",
        politicaCodigo: "AL_COBRO",
        monedaCodigo: "JUS",
        tasaInteresMensualPct: "5.00",
        fechaVencimiento: new Date("2026-01-01T00:00:00.000Z"),
      }),
      VJ,
      new Date("2026-06-09T00:00:00.000Z"),
    );
    expect(result.interesPesos).toBe(0);
    expect(result.saldoPesos).toBeCloseTo(4 * Number(VJ), 2);
  });
});
