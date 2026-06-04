import { describe, expect, it } from "vitest";
import { calcularSaldoCuota } from "../services/planes.service.js";

describe("capital e interes en aplicaciones", () => {
  it("el interes cobrado no reduce capital pendiente", async () => {
    const saldo = await calcularSaldoCuota(
      {
        montoJus: null,
        montoPesos: "10000.00",
        valorJusRef: null,
        politicaCodigo: null,
      },
      [{
        monto: "11000.00",
        montoCapital: "10000.00",
        montoInteres: "1000.00",
        fechaIngreso: new Date("2026-04-01T00:00:00.000Z"),
        valorJusAlCobro: null,
      }],
      new Date("2026-04-01T00:00:00.000Z"),
      async () => 0,
    );

    expect(saldo.capitalNativo.toPg()).toBe("0.00");
    expect(saldo.saldoPesos.toPg()).toBe("0.00");
  });

  it("un pago parcial que cubre solo mora no reduce capital", async () => {
    const saldo = await calcularSaldoCuota(
      {
        montoJus: null,
        montoPesos: "10000.00",
        valorJusRef: null,
        politicaCodigo: null,
      },
      [{
        monto: "500.00",
        montoCapital: "0.00",
        montoInteres: "500.00",
        fechaIngreso: new Date("2026-04-01T00:00:00.000Z"),
        valorJusAlCobro: null,
      }],
      new Date("2026-04-01T00:00:00.000Z"),
      async () => 0,
    );

    expect(saldo.capitalNativo.toPg()).toBe("10000.00");
    expect(saldo.saldoPesos.toPg()).toBe("10000.00");
  });
});
