import { describe, expect, it } from "vitest";
import { Decimal, jus, pesos } from "../utils/decimal.js";

describe("Decimal", () => {
  it("redondea HALF_UP y BANKERS de forma explicita", () => {
    expect(Decimal.of("1.005", 2).toPg()).toBe("1.01");
    expect(Decimal.of("1.005", 2, "BANKERS").toPg()).toBe("1.00");
    expect(Decimal.of("1.015", 2, "BANKERS").toPg()).toBe("1.02");
  });

  it("multiplica y divide JUS por cotizacion sin deriva binaria", () => {
    const montoPesos = jus("10.0000").mulByRate(jus("12345.6789"), 2);
    expect(montoPesos.toPg()).toBe("123456.79");
    expect(montoPesos.divByRate(jus("12345.6789"), 4).toPg()).toBe("10.0000");
  });

  it("falla al sumar escalas distintas", () => {
    expect(() => pesos("1.00").add(jus("1.0000"))).toThrow("DECIMAL_SCALE_MISMATCH");
  });

  it("resuelve el caso clasico 0.1 + 0.2", () => {
    expect(pesos("0.10").add(pesos("0.20")).toPg()).toBe("0.30");
  });

  it("suma 1000 micropagos sin deriva", () => {
    let total = Decimal.zero(4);
    for (let i = 0; i < 1000; i++) total = total.add(jus("0.0001"));
    expect(total.toPg()).toBe("0.1000");
  });
});
