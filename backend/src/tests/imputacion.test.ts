import { describe, expect, it } from "vitest";
import { pesos } from "../utils/decimal.js";
import { imputarIngreso, ordenarPrelacion, type DeudaImputable } from "../services/imputacion.js";

describe("imputacion", () => {
  it("FIFO por antigüedad exigible: sin prioridad por tipo; interés antes que capital", () => {
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
    // Orden solo por fecha: cuota mayo → gasto junio → cuota julio
    expect(ordenadas.map((d) => d.id)).toEqual(["cuota:vencida", "gasto:1", "cuota:futura"]);

    const resultado = imputarIngreso(pesos("50000"), ordenadas);
    expect(resultado.movimientos.map((m) => m.deudaId)).toEqual(["cuota:vencida", "gasto:1", "cuota:futura"]);
    expect(resultado.movimientos[0].aInteres.toPg()).toBe("5000.00");
    expect(resultado.movimientos[0].aCapital.toPg()).toBe("30000.00");
    expect(resultado.movimientos[1].aCapital.toPg()).toBe("10000.00");
    expect(resultado.movimientos[2].aCapital.toPg()).toBe("5000.00");
    expect(resultado.remanente.toPg()).toBe("0.00");
  });

  it("honorarios y gastos se ordenan solo por antigüedad exigible", () => {
    const deudas: DeudaImputable[] = [
      {
        id: "honorario:futuro",
        tipo: "HONORARIO",
        vencimiento: new Date("2026-08-01T00:00:00.000Z"),
        interesPesos: pesos("0"),
        saldoPesos: pesos("20000"),
      },
      {
        id: "honorario:vencido",
        tipo: "HONORARIO",
        vencimiento: new Date("2026-04-01T00:00:00.000Z"),
        interesPesos: pesos("3000"),
        saldoPesos: pesos("20000"),
      },
      {
        id: "gasto:1",
        tipo: "GASTO",
        vencimiento: new Date("2026-09-01T00:00:00.000Z"),
        interesPesos: pesos("0"),
        saldoPesos: pesos("5000"),
      },
    ];

    const ordenadas = ordenarPrelacion(deudas, new Date("2026-06-15T00:00:00.000Z"));
    expect(ordenadas.map((d) => d.id)).toEqual(["honorario:vencido", "honorario:futuro", "gasto:1"]);

    const resultado = imputarIngreso(pesos("10000"), ordenadas);
    expect(resultado.movimientos[0].deudaId).toBe("honorario:vencido");
    expect(resultado.movimientos[0].aInteres.toPg()).toBe("3000.00");
    expect(resultado.movimientos[0].aCapital.toPg()).toBe("7000.00");
    expect(resultado.remanente.toPg()).toBe("0.00");
  });
});
