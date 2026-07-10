import { describe, expect, it } from "vitest";
import {
  agruparCuotasPorUsuario,
  buildCobranzaPushBody,
  clasificarCuotasCobranza,
  cuotaTieneSaldoPendiente,
  formatSaldoCuota,
  isPastDailyCobranzaWindow,
  resolveNombreDeudorCobranza,
  startOfDayArgentina,
  type CuotaRecordatorio,
} from "../services/cobranza-recordatorio.js";

function cuota(overrides: Partial<CuotaRecordatorio> = {}): CuotaRecordatorio {
  return {
    cuotaId: 1,
    numero: 1,
    vencimiento: new Date("2026-07-01T03:00:00.000Z"),
    montoPesos: "10000.00",
    montoJus: null,
    montoAplicado: "0.00",
    valorJusRef: null,
    clienteNombre: "Cliente Test",
    casoCaratula: "Pérez c/ Gómez",
    createdBy: 10,
    ...overrides,
  };
}

describe("cobranza-recordatorio", () => {
  it("detecta saldo pendiente en pesos y JUS", () => {
    expect(cuotaTieneSaldoPendiente({
      montoPesos: "1000.00",
      montoJus: null,
      montoAplicado: "200.00",
      valorJusRef: null,
    })).toBe(true);

    expect(cuotaTieneSaldoPendiente({
      montoPesos: "1000.00",
      montoJus: null,
      montoAplicado: "1000.00",
      valorJusRef: null,
    })).toBe(false);

    expect(cuotaTieneSaldoPendiente({
      montoPesos: null,
      montoJus: "10.0000",
      montoAplicado: "4000.00",
      valorJusRef: "2000.0000",
    })).toBe(true);

    // AL_COBRO: jusPagados con valorJusAlCobro por aplicación (no montoAplicado/valorJusRef)
    expect(cuotaTieneSaldoPendiente({
      montoPesos: null,
      montoJus: "10.0000",
      montoAplicado: "4000.00",
      valorJusRef: "2000.0000",
      jusPagados: "10.0000",
    })).toBe(false);

    expect(cuotaTieneSaldoPendiente({
      montoPesos: null,
      montoJus: "10.0000",
      montoAplicado: "4000.00",
      valorJusRef: "2000.0000",
      jusPagados: "2.0000",
    })).toBe(true);
  });

  it("formatea saldo en pesos y JUS", () => {
    expect(formatSaldoCuota({
      montoPesos: "15000.00",
      montoJus: null,
      montoAplicado: "5000.00",
      valorJusRef: null,
    })).toContain("10.000");

    expect(formatSaldoCuota({
      montoPesos: null,
      montoJus: "5.0000",
      montoAplicado: "2000.00",
      valorJusRef: "2000.0000",
    })).toBe("4 JUS");
  });

  it("clasifica cuotas vencidas y por vencer segun dias de anticipacion", () => {
    const hoy = startOfDayArgentina(new Date("2026-07-08T12:00:00.000Z"));

    const cuotas = [
      cuota({ cuotaId: 1, vencimiento: new Date("2026-07-05T03:00:00.000Z") }),
      cuota({ cuotaId: 2, vencimiento: new Date("2026-07-08T03:00:00.000Z") }),
      cuota({ cuotaId: 3, vencimiento: new Date("2026-07-10T03:00:00.000Z") }),
      cuota({ cuotaId: 4, vencimiento: new Date("2026-07-20T03:00:00.000Z") }),
      cuota({ cuotaId: 5, vencimiento: new Date("2026-07-09T03:00:00.000Z"), montoAplicado: "10000.00" }),
    ];

    const { vencidas, porVencer } = clasificarCuotasCobranza(cuotas, hoy, 3);

    expect(vencidas.map((c) => c.cuotaId)).toEqual([1]);
    expect(porVencer.map((c) => c.cuotaId)).toEqual([2, 3]);
  });

  it("agrupa cuotas por createdBy", () => {
    const cuotas = [
      cuota({ cuotaId: 1, createdBy: 10 }),
      cuota({ cuotaId: 2, createdBy: 20 }),
      cuota({ cuotaId: 3, createdBy: 10 }),
    ];

    const grouped = agruparCuotasPorUsuario(cuotas);

    expect(grouped.get(10)?.map((c) => c.cuotaId)).toEqual([1, 3]);
    expect(grouped.get(20)?.map((c) => c.cuotaId)).toEqual([2]);
  });

  it("arma el body del push resumen", () => {
    expect(buildCobranzaPushBody(3, 2)).toBe("3 cuotas vencidas y 2 por vencer");
    expect(buildCobranzaPushBody(1, 0)).toBe("1 cuota vencida");
    expect(buildCobranzaPushBody(0, 1)).toBe("1 por vencer");
  });

  it("habilita la ventana diaria a partir de las 08:00 hora Argentina", () => {
    expect(isPastDailyCobranzaWindow(new Date("2026-07-08T12:00:00.000Z"))).toBe(true);
    expect(isPastDailyCobranzaWindow(new Date("2026-07-08T10:00:00.000Z"))).toBe(false);
  });

  it("usa el nombre del deudor tercero en el recordatorio de cuotas del plan", () => {
    // Misma prioridad que CobranzaRecordatorioQueries (SQL CASE).
    expect(resolveNombreDeudorCobranza({
      obligadoTerceroId: 55,
      obligadoClienteId: 10,
      terceroNombre: "Aseguradora XYZ SA",
      obligadoClienteNombre: "Cliente Obligado",
      clienteNombre: "Cliente Titular",
    })).toBe("Aseguradora XYZ SA");

    expect(resolveNombreDeudorCobranza({
      obligadoTerceroId: null,
      obligadoClienteId: 22,
      terceroNombre: null,
      obligadoClienteNombre: "Otro Cliente",
      clienteNombre: "Cliente Titular",
    })).toBe("Otro Cliente");

    const cuotas = [
      cuota({
        cuotaId: 10,
        clienteNombre: resolveNombreDeudorCobranza({
          obligadoTerceroId: 55,
          terceroNombre: "Aseguradora XYZ SA",
          clienteNombre: "Cliente Titular",
        }),
        casoCaratula: "Pérez c/ Gómez",
        createdBy: 7,
      }),
    ];

    const grouped = agruparCuotasPorUsuario(cuotas);
    expect(grouped.get(7)?.[0]?.clienteNombre).toBe("Aseguradora XYZ SA");
  });
});
