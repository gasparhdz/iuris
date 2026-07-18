import { describe, expect, it } from "vitest";
import { buildCuentaCorriente, type CCHonorario, type CCIngreso } from "../services/cuenta-corriente.js";
import {
  honorarioDeudorEsCliente,
  resolveHonorarioDeudor,
} from "../services/honorario-deudor.js";

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

describe("resolveHonorarioDeudor", () => {
  it("prioriza obligadoTerceroId sobre cliente", () => {
    expect(resolveHonorarioDeudor({
      clienteId: 10,
      obligadoClienteId: 10,
      obligadoTerceroId: 55,
    })).toEqual({ tipo: "tercero", id: 55 });
  });

  it("usa obligadoClienteId si no hay tercero", () => {
    expect(resolveHonorarioDeudor({
      clienteId: 10,
      obligadoClienteId: 22,
      obligadoTerceroId: null,
    })).toEqual({ tipo: "cliente", id: 22 });
  });

  it("fallback a clienteId cuando ambos obligados son null (registros viejos)", () => {
    expect(resolveHonorarioDeudor({
      clienteId: 10,
      obligadoClienteId: null,
      obligadoTerceroId: null,
    })).toEqual({ tipo: "cliente", id: 10 });
  });

  it("honorario con obligado tercero NO pertenece al cliente del caso", () => {
    const h = { clienteId: 10, obligadoClienteId: null, obligadoTerceroId: 55 };
    expect(honorarioDeudorEsCliente(h, 10)).toBe(false);
    expect(honorarioDeudorEsCliente(h, 55)).toBe(false);
  });

  it("honorario sin obligado sí suma al cliente (fallback)", () => {
    const h = { clienteId: 10, obligadoClienteId: null, obligadoTerceroId: null };
    expect(honorarioDeudorEsCliente(h, 10)).toBe(true);
  });
});

describe("cuenta corriente: filtrado por deudor", () => {
  it("honorario con deudor tercero no entra en el saldo del cliente", () => {
    const delCliente = honorarioBase({
      id: 1,
      montoPesos: "100000.00",
      monedaCodigo: "ARS",
      jus: null,
    });
    const delTercero = honorarioBase({
      id: 2,
      montoPesos: "500000.00",
      monedaCodigo: "ARS",
      jus: null,
    });

    const honorariosCliente = [
      { ...delCliente, clienteId: 10, obligadoClienteId: null, obligadoTerceroId: null },
      { ...delTercero, clienteId: 10, obligadoClienteId: null, obligadoTerceroId: 99 },
    ].filter((h) => honorarioDeudorEsCliente(h, 10));

    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-06-09T00:00:00.000Z"),
      valorJusActual: VJ,
      honorarios: honorariosCliente,
      gastos: [],
      ingresos: [],
    });

    // Solo el de $100.000 (fallback cliente); el de $500.000 del tercero queda fuera.
    expect(result.totales.honorariosPesos).toBe(100000);
    expect(result.totales.saldoPesos).toBe(100000);
  });

  it("honorario sin obligado (legacy) sí suma al clienteId", () => {
    const legacy = honorarioBase({
      id: 3,
      montoPesos: "25000.00",
      monedaCodigo: "ARS",
      jus: null,
    });
    const honorarios = [
      { ...legacy, clienteId: 7, obligadoClienteId: null, obligadoTerceroId: null },
    ].filter((h) => honorarioDeudorEsCliente(h, 7));

    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-06-09T00:00:00.000Z"),
      valorJusActual: VJ,
      honorarios,
      gastos: [],
      ingresos: [],
    });

    expect(result.totales.saldoPesos).toBe(25000);
  });
});

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
    // debe 4x100000=400000 (valor de origen), haber 300000 → la revalorización
    // del JUS adeudado (1 JUS x 10000) entra como ajuste AL DEBE, nunca al haber.
    expect(ajustes[0].debe).toBe(10000);
    expect(ajustes[0].haber).toBe(0);
    const honorarioRow = result.rows.find((r) => r.tipo === "HONORARIO");
    expect(honorarioRow?.debe).toBe(400000);
  });

  it("AL_COBRO con historial: el ajuste va en la fecha de vigencia del JUS, sobre los JUS adeudados", () => {
    // Caso LOPEZ CELESTE: 3 JUS pactados a 132863.18; paga 1 JUS el 10/03; el 01/04
    // entra en vigencia el JUS 136317.62 → ajuste ese día por los 2 JUS adeudados
    // (2 x 3454.44 = $6.908,88); el 21/04 paga los 2 JUS restantes y cierra en $0.
    const vjNuevo = "136317.6200";
    const fechaVigencia = new Date("2026-04-01T00:00:00.000Z");
    const pago1 = { fecha: new Date("2026-03-10T00:00:00.000Z"), montoCapital: "132863.18", montoInteres: "0.00", valorJusAlCobro: VJ };
    const pago2 = { fecha: new Date("2026-04-21T00:00:00.000Z"), montoCapital: "272635.24", montoInteres: "0.00", valorJusAlCobro: vjNuevo };
    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-07-18T00:00:00.000Z"),
      valorJusActual: vjNuevo,
      valoresJus: [
        { fecha: new Date("2026-01-02T00:00:00.000Z"), valor: VJ },
        { fecha: fechaVigencia, valor: vjNuevo },
      ],
      honorarios: [
        honorarioBase({
          jus: "3.0000",
          valorJusRef: VJ,
          fechaRegulacion: new Date("2026-03-01T00:00:00.000Z"),
          politicaCodigo: "AL_COBRO",
          aplicaciones: [pago1, pago2],
        }),
      ],
      gastos: [],
      ingresos: [
        { id: 20, descripcion: "Ingreso", fecha: pago1.fecha, monto: "132863.18" },
        { id: 21, descripcion: "Ingreso", fecha: pago2.fecha, monto: "272635.24" },
      ],
    });

    const ajustes = result.rows.filter((r) => r.tipo === "AJUSTE");
    expect(ajustes).toHaveLength(1);
    // Fecha de vigencia del JUS nuevo (01/04), sobre 2 JUS adeudados, no estimado
    expect(ajustes[0].fecha).toBe(fechaVigencia.toISOString());
    expect(ajustes[0].debe).toBe(6908.88);
    expect(ajustes[0].cantidadJus).toBe(2);
    expect(ajustes[0].valorJusAplicado).toBe(136317.62);
    expect(ajustes[0].esEstimado).toBe(false);
    // El saldo corrido nunca inventa un "a favor"
    expect(result.rows.every((r) => r.saldo >= 0)).toBe(true);
    expect(result.totales.saldoPesos).toBe(0);
    expect(result.rows[result.rows.length - 1].saldo).toBe(0);
  });

  it("con historial, un cambio de JUS posterior al pago total no genera ajuste (no debe nada)", () => {
    const vjNuevo = "136317.6200";
    const pago = { fecha: new Date("2026-03-10T00:00:00.000Z"), montoCapital: "398589.54", montoInteres: "0.00", valorJusAlCobro: VJ };
    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-07-18T00:00:00.000Z"),
      valorJusActual: vjNuevo,
      valoresJus: [
        { fecha: new Date("2026-01-02T00:00:00.000Z"), valor: VJ },
        { fecha: new Date("2026-04-01T00:00:00.000Z"), valor: vjNuevo },
      ],
      honorarios: [
        honorarioBase({
          jus: "3.0000",
          valorJusRef: VJ,
          fechaRegulacion: new Date("2026-03-01T00:00:00.000Z"),
          politicaCodigo: "AL_COBRO",
          aplicaciones: [pago],
        }),
      ],
      gastos: [],
      ingresos: [{ id: 30, descripcion: "Ingreso", fecha: pago.fecha, monto: "398589.54" }],
    });

    expect(result.rows.filter((r) => r.tipo === "AJUSTE")).toHaveLength(0);
    expect(result.totales.saldoPesos).toBe(0);
  });

  it("un pago imputado a varias cuotas genera un solo ajuste por cambio de JUS (caso con plan)", () => {
    // LOPEZ con plan: el pago del 21/04 se imputa a las cuotas 2 y 3 (1 JUS c/u a 136317.62).
    const vjNuevo = "136317.6200";
    const f1 = new Date("2026-03-10T00:00:00.000Z");
    const f2 = new Date("2026-04-21T00:00:00.000Z");
    const fechaVigencia = new Date("2026-04-01T00:00:00.000Z");
    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-07-18T00:00:00.000Z"),
      valorJusActual: vjNuevo,
      valoresJus: [
        { fecha: new Date("2026-01-02T00:00:00.000Z"), valor: VJ },
        { fecha: fechaVigencia, valor: vjNuevo },
      ],
      honorarios: [
        honorarioBase({
          jus: "3.0000",
          valorJusRef: VJ,
          fechaRegulacion: new Date("2026-03-01T00:00:00.000Z"),
          politicaCodigo: "AL_COBRO",
          plan: {
            tasaInteresMensual: null,
            regimenMora: null,
            politicaCodigo: "AL_COBRO",
            valorJusRef: VJ,
            cuotas: [
              { id: 1, numero: 1, vencimiento: f1, montoJus: "1.0000", montoPesos: null, valorJusRef: VJ, aplicaciones: [
                { fecha: f1, montoCapital: "132863.18", montoInteres: "0.00", valorJusAlCobro: VJ },
              ] },
              { id: 2, numero: 2, vencimiento: f2, montoJus: "1.0000", montoPesos: null, valorJusRef: VJ, aplicaciones: [
                { fecha: f2, montoCapital: "136317.62", montoInteres: "0.00", valorJusAlCobro: vjNuevo },
              ] },
              { id: 3, numero: 3, vencimiento: f2, montoJus: "1.0000", montoPesos: null, valorJusRef: VJ, aplicaciones: [
                { fecha: f2, montoCapital: "136317.62", montoInteres: "0.00", valorJusAlCobro: vjNuevo },
              ] },
            ],
          },
        }),
      ],
      gastos: [],
      ingresos: [
        { id: 20, descripcion: "Ingreso", fecha: f1, monto: "132863.18" },
        { id: 21, descripcion: "Ingreso", fecha: f2, monto: "272635.24" },
      ],
    });

    const ajustes = result.rows.filter((r) => r.tipo === "AJUSTE");
    expect(ajustes).toHaveLength(1);
    expect(ajustes[0].fecha).toBe(fechaVigencia.toISOString());
    expect(ajustes[0].debe).toBe(6908.88);
    expect(result.totales.saldoPesos).toBe(0);
    expect(result.rows.every((r) => r.saldo >= 0)).toBe(true);
  });

  it("pago a cuenta anterior a la regulación: resta sus pesos al valor de la regulación, sin ajuste", () => {
    // Caso ORELLANO: paga $110.000 en agosto (JUS 100000); el honorario se regula en
    // noviembre a 132863.18. El pago no puede cancelar JUS a un valor previo a que
    // exista la deuda: resta $110.000 nominales al valor de la regulación y listo.
    const vjViejo = "100000.0000";
    const fechaRegulacion = new Date("2025-11-07T00:00:00.000Z");
    const pago = { fecha: new Date("2025-08-20T00:00:00.000Z"), montoCapital: "110000.00", montoInteres: "0.00", valorJusAlCobro: vjViejo };
    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-07-18T00:00:00.000Z"),
      valorJusActual: VJ,
      valoresJus: [
        { fecha: new Date("2025-08-01T00:00:00.000Z"), valor: vjViejo },
        { fecha: new Date("2025-11-01T00:00:00.000Z"), valor: VJ },
      ],
      honorarios: [
        honorarioBase({
          jus: "3.0000",
          valorJusRef: VJ,
          fechaRegulacion,
          politicaCodigo: "AL_COBRO",
          aplicaciones: [pago],
        }),
      ],
      gastos: [],
      ingresos: [{ id: 40, descripcion: "Ingreso", fecha: pago.fecha, monto: "110000.00" }],
    });

    // Sin ajustes: el pago resta nominal contra el capital regulado
    expect(result.rows.filter((r) => r.tipo === "AJUSTE")).toHaveLength(0);
    // saldo = 3 JUS x 132863.18 - 110000 = $288.589,54
    expect(result.totales.saldoPesos).toBe(288589.54);
  });

  it("JUS retroactivo: un pago hecho al valor conocido en su momento no se ajusta, aunque la vigencia sea anterior", () => {
    // Cliente X: 10 JUS a 93968.07 (01/01/2026). Paga 1 JUS el 10/01 y 1 JUS el 10/02,
    // ambos a 93968.07. El 06/04 se publica el valor 95847.43 con vigencia 01/02
    // (retroactiva). El JUS pagado el 10/02 quedó cancelado al valor conocido entonces:
    // el ajuste se calcula solo sobre los 8 JUS impagos (8 x 1879.36 = $15.034,88).
    const vjViejo = "93968.0700";
    const vjNuevo = "95847.4300";
    const vigencia = new Date("2026-02-01T00:00:00.000Z");
    const pago1 = { fecha: new Date("2026-01-10T00:00:00.000Z"), montoCapital: "93968.07", montoInteres: "0.00", valorJusAlCobro: vjViejo };
    const pago2 = { fecha: new Date("2026-02-10T00:00:00.000Z"), montoCapital: "93968.07", montoInteres: "0.00", valorJusAlCobro: vjViejo };
    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-07-18T00:00:00.000Z"),
      valorJusActual: vjNuevo,
      valoresJus: [
        { fecha: new Date("2026-01-01T00:00:00.000Z"), valor: vjViejo },
        { fecha: vigencia, valor: vjNuevo },
      ],
      honorarios: [
        honorarioBase({
          jus: "10.0000",
          valorJusRef: vjViejo,
          fechaRegulacion: new Date("2026-01-01T00:00:00.000Z"),
          politicaCodigo: "AL_COBRO",
          aplicaciones: [pago1, pago2],
        }),
      ],
      gastos: [],
      ingresos: [
        { id: 50, descripcion: "Ingreso", fecha: pago1.fecha, monto: "93968.07" },
        { id: 51, descripcion: "Ingreso", fecha: pago2.fecha, monto: "93968.07" },
      ],
    });

    const ajustes = result.rows.filter((r) => r.tipo === "AJUSTE");
    expect(ajustes).toHaveLength(1);
    expect(ajustes[0].fecha).toBe(vigencia.toISOString());
    expect(ajustes[0].cantidadJus).toBe(8);
    expect(ajustes[0].debe).toBe(15034.88);
    // Saldo: 8 JUS x 95847.43 = $766.779,44 — sin residual al corte
    expect(result.totales.saldoPesos).toBe(766779.44);
    expect(result.totales.saldoJus).toBe(8);
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
