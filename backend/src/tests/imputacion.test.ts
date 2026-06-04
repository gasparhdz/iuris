import { describe, expect, it } from "vitest";
import { pesos } from "../utils/decimal.js";
import { imputarIngreso, ordenarPrelacion, type DeudaImputable } from "../services/imputacion.js";

describe("imputacion", () => {
  it("aplica gasto, cuota vencida interes antes que capital, y remanente a cuota futura", () => {
    const deudas: DeudaImputable[] = [
      {
        id: "cuota:futura",
        tipo: "CUOTA",
        vencimiento: new Date("2026-07-10T00:00:00.000Z"),
        interesPesos: pesos("0"),
        saldoPesos: pesos("30000"),
      },
      {
        id: "cuota:vencida",
        tipo: "CUOTA",
        vencimiento: new Date("2026-05-01T00:00:00.000Z"),
        interesPesos: pesos("5000"),
        saldoPesos: pesos("30000"),
      },
      {
        id: "gasto:1",
        tipo: "GASTO",
        vencimiento: new Date("2026-06-01T00:00:00.000Z"),
        interesPesos: pesos("0"),
        saldoPesos: pesos("10000"),
      },
    ];

    const ordenadas = ordenarPrelacion(deudas, new Date("2026-06-15T00:00:00.000Z"));
    const resultado = imputarIngreso(pesos("50000"), ordenadas);

    expect(resultado.movimientos.map((m) => m.deudaId)).toEqual(["gasto:1", "cuota:vencida", "cuota:futura"]);
    expect(resultado.movimientos[1].aInteres.toPg()).toBe("5000.00");
    expect(resultado.movimientos[1].aCapital.toPg()).toBe("30000.00");
    expect(resultado.movimientos[2].aCapital.toPg()).toBe("5000.00");
    expect(resultado.remanente.toPg()).toBe("0.00");
  });
});
