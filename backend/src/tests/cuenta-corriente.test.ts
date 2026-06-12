import { describe, expect, it } from "vitest";
import { buildCuentaCorriente, type CCHonorario, type CCIngreso } from "../services/cuenta-corriente.js";

const VJ = "132863.1800"; // valor JUS de referencia de los casos reales

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
    monedaCodigo: "JUS",
    tasaInteresMensualPct: null,
    plan: null,
    aplicaciones: [],
    ...overrides,
  };
}

describe("cuenta corriente (motor Decimal)", () => {
  it("caso A: honorario 4 JUS AL_COBRO con cobro de $300.000 deja saldo $231.452,72", () => {
    const ingreso: CCIngreso = {
      id: 10,
      descripcion: "Cobro",
      fecha: new Date("2026-05-15T00:00:00.000Z"),
      monto: "300000.00",
    };
    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-06-09T00:00:00.000Z"),
      valorJusActual: VJ,
      honorarios: [
        honorarioBase({
          jus: "4.0000",
          valorJusRef: VJ,
          politicaCodigo: "AL_COBRO",
          tasaInteresMensualPct: "5.00",
          aplicaciones: [
            { fecha: ingreso.fecha, montoCapital: "300000.00", montoInteres: "0.00", valorJusAlCobro: VJ },
          ],
        }),
      ],
      gastos: [],
      ingresos: [ingreso],
    });

    expect(result.totales.saldoPesos).toBe(231452.72);
    // AL_COBRO no devenga mora: ninguna fila de interés
    expect(result.rows.filter((r) => r.tipo === "INTERES")).toHaveLength(0);
    // Sin cambio de cotización tampoco hay ajuste
    expect(result.rows.filter((r) => r.tipo === "AJUSTE")).toHaveLength(0);
    const last = result.rows[result.rows.length - 1];
    expect(last.saldo).toBe(231452.72);
  });

  it("caso B: honorario 9 JUS FECHA_REGULACION con plan de 3 cuotas, mora solo de la cuota vencida", () => {
    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-06-09T00:00:00.000Z"),
      valorJusActual: VJ,
      honorarios: [
        honorarioBase({
          jus: "9.0000",
          valorJusRef: VJ,
          politicaCodigo: "FECHA_REGULACION",
          tasaInteresMensualPct: "5.00",
          plan: {
            tasaInteresMensual: "0.050000", // los planes guardan fracción
            regimenMora: "SIMPLE",
            politicaCodigo: "FECHA_REGULACION",
            valorJusRef: VJ,
            cuotas: [
              { id: 1, numero: 1, vencimiento: new Date("2026-05-10T00:00:00.000Z"), montoJus: "3.0000", montoPesos: null, valorJusRef: VJ, aplicaciones: [] },
              { id: 2, numero: 2, vencimiento: new Date("2026-06-10T00:00:00.000Z"), montoJus: "3.0000", montoPesos: null, valorJusRef: VJ, aplicaciones: [] },
              { id: 3, numero: 3, vencimiento: new Date("2026-07-10T00:00:00.000Z"), montoJus: "3.0000", montoPesos: null, valorJusRef: VJ, aplicaciones: [] },
            ],
          },
        }),
      ],
      gastos: [],
      ingresos: [],
    });

    // capital 9 JUS x 132863.18 = 1.195.768,62
    const debeHonorario = result.rows.find((r) => r.tipo === "HONORARIO");
    expect(debeHonorario?.debe).toBe(1195768.62);

    // mora SOLO de la cuota 1 (vencida 10/05, 30 días al 5%): 3 JUS x 5% = 0,15 JUS = $19.929,48
    const intereses = result.rows.filter((r) => r.tipo === "INTERES");
    expect(intereses).toHaveLength(1);
    expect(intereses[0].debe).toBe(19929.48);

    expect(result.totales.saldoPesos).toBe(1215698.1);
  });

  it("honorario en pesos vencido devenga mora simple con tasa porcentual de la tabla honorarios", () => {
    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-04-01T00:00:00.000Z"),
      valorJusActual: VJ,
      honorarios: [
        honorarioBase({
          monedaCodigo: "ARS",
          montoPesos: "100000.00",
          fechaRegulacion: new Date("2026-01-01T00:00:00.000Z"),
          fechaVencimiento: new Date("2026-01-01T00:00:00.000Z"),
          tasaInteresMensualPct: "10.00", // 10% mensual guardado como porcentaje
        }),
      ],
      gastos: [],
      ingresos: [],
    });

    // 90 días al 10% mensual simple = $30.000 (no $90.000.000 como daría tratar 10.00 de fracción)
    const intereses = result.rows.filter((r) => r.tipo === "INTERES");
    expect(intereses).toHaveLength(1);
    expect(intereses[0].debe).toBe(30000);
    expect(result.totales.saldoPesos).toBe(130000);
  });

  it("AL_COBRO con suba del JUS posterior al pago genera fila de ajuste y saldo revaluado exacto", () => {
    const pago = { fecha: new Date("2026-03-01T00:00:00.000Z"), montoCapital: "300000.00", montoInteres: "0.00", valorJusAlCobro: "100000.0000" };
    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-06-09T00:00:00.000Z"),
      valorJusActual: "110000.0000",
      honorarios: [
        honorarioBase({
          jus: "4.0000",
          valorJusRef: "100000.0000",
          politicaCodigo: "AL_COBRO",
          aplicaciones: [pago],
        }),
      ],
      gastos: [],
      ingresos: [{ id: 11, descripcion: "Cobro", fecha: pago.fecha, monto: "300000.00" }],
    });

    // pagó 3 JUS (300000 / 100000); queda 1 JUS x 110000 = $110.000
    expect(result.totales.saldoPesos).toBe(110000);
    const ajustes = result.rows.filter((r) => r.tipo === "AJUSTE");
    expect(ajustes).toHaveLength(1);
    // debe 4x110000=440000, haber 300000 → el ajuste devuelve 30000 para cerrar en 110000
    expect(ajustes[0].haber).toBe(30000);
  });

  it("gastos suman al debe y un ingreso sin aplicaciones igual descuenta del saldo", () => {
    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-06-09T00:00:00.000Z"),
      valorJusActual: VJ,
      honorarios: [],
      gastos: [
        { id: 1, descripcion: "Tasa de justicia", fecha: new Date("2026-02-01T00:00:00.000Z"), monto: "50000.00", cotizacionArs: null },
      ],
      ingresos: [
        { id: 2, descripcion: "Pago a cuenta", fecha: new Date("2026-03-01T00:00:00.000Z"), monto: "20000.00" },
      ],
    });

    expect(result.totales.saldoPesos).toBe(30000);
    expect(result.rows.map((r) => r.tipo)).toEqual(["GASTO", "INGRESO"]);
    expect(result.rows[1].saldo).toBe(30000);
  });
});
