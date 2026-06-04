import { describe, expect, it } from "vitest";
import { calcularMora, moraAplica, normalizeRegimenMora } from "../services/mora.js";
import { jus, pesos, tasa } from "../utils/decimal.js";

describe("mora", () => {
  it("simple y compuesto sobre 90 dias dan resultados distintos y conocidos", () => {
    const base = {
      capital: pesos("1000"),
      moneda: "PESOS" as const,
      vencimiento: new Date("2026-01-01T00:00:00.000Z"),
      fechaCorte: new Date("2026-04-01T00:00:00.000Z"),
      tasaMensual: tasa("0.100000"),
      baseDias: 30 as const,
    };

    const simple = calcularMora({ ...base, regimen: "SIMPLE" });
    const compuesto = calcularMora({ ...base, regimen: "COMPUESTO" });

    expect(simple.interesPesos.toPg()).toBe("300.00");
    expect(compuesto.interesPesos.toPg()).toBe("331.00");
  });

  it("cuota JUS devenga interes en JUS y se valua al JUS del corte", () => {
    const resultado = calcularMora({
      capital: jus("10"),
      moneda: "JUS",
      vencimiento: new Date("2026-01-01T00:00:00.000Z"),
      fechaCorte: new Date("2026-02-01T00:00:00.000Z"),
      tasaMensual: tasa("0.100000"),
      valorJusAlCorte: jus("2000"),
    });

    expect(resultado.interesNativo.toPg()).toBe("1.0333");
    expect(resultado.interesPesos.toPg()).toBe("2066.60");
  });

  it("no devenga mora antes del vencimiento", () => {
    const resultado = calcularMora({
      capital: pesos("1000"),
      moneda: "PESOS",
      vencimiento: new Date("2026-06-10T00:00:00.000Z"),
      fechaCorte: new Date("2026-06-04T00:00:00.000Z"),
      tasaMensual: tasa("0.100000"),
    });

    expect(resultado.interesPesos.toPg()).toBe("0.00");
    expect(resultado.tramos).toHaveLength(0);
  });

  it("usa la misma regla por defecto para JUS AL_COBRO: no aplica mora", () => {
    const params = {
      politicaCodigo: "AL_COBRO",
      esJus: true,
      esUsd: false,
      tieneMontoPesos: false,
      tasaMensual: tasa("0.100000"),
      vencida: true,
      saldoPositivo: true,
    };

    expect(moraAplica(params)).toBe(false);
  });

  it("normaliza regimen COMPUESTO y produce mas interes que SIMPLE a 90 dias", () => {
    const base = {
      capital: pesos("1000"),
      moneda: "PESOS" as const,
      vencimiento: new Date("2026-01-01T00:00:00.000Z"),
      fechaCorte: new Date("2026-04-01T00:00:00.000Z"),
      tasaMensual: tasa("0.100000"),
    };
    const simple = calcularMora({ ...base, regimen: normalizeRegimenMora("SIMPLE") }).interesPesos;
    const compuesto = calcularMora({ ...base, regimen: normalizeRegimenMora("COMPUESTO") }).interesPesos;

    expect(compuesto.gt(simple)).toBe(true);
  });
});
