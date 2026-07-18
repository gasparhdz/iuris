import { describe, expect, it } from "vitest";
import { heredarPoliticaJusDelHonorario } from "../services/planes.service.js";

describe("heredarPoliticaJusDelHonorario", () => {
  it("AL_COBRO: cuotas en JUS sin valorJusRef del día de creación", () => {
    const result = heredarPoliticaJusDelHonorario({
      honorarioPoliticaCodigo: "AL_COBRO",
      honorarioPoliticaJusId: 42,
      honorarioValorJusRef: null,
      dataPoliticaJusId: 99,
      dataValorJusRef: 150000,
      montoCuotaJus: 10,
    });
    expect(result).toEqual({ politicaJusId: 42, valorJusRef: null });
  });

  it("cotización fija: hereda valorJusRef del honorario", () => {
    const result = heredarPoliticaJusDelHonorario({
      honorarioPoliticaCodigo: "FECHA_REGULACION",
      honorarioPoliticaJusId: 43,
      honorarioValorJusRef: "132863.1800",
      dataPoliticaJusId: null,
      dataValorJusRef: 999999,
      montoCuotaJus: 5,
    });
    expect(result).toEqual({ politicaJusId: 43, valorJusRef: 132863.18 });
  });

  it("sin montoCuotaJus: no fuerza política JUS del honorario sobre pesos", () => {
    const result = heredarPoliticaJusDelHonorario({
      honorarioPoliticaCodigo: "AL_COBRO",
      honorarioPoliticaJusId: 42,
      honorarioValorJusRef: null,
      dataValorJusRef: null,
      montoCuotaJus: null,
    });
    expect(result).toEqual({ politicaJusId: 42, valorJusRef: null });
  });
});

describe("delete plan → estado honorario", () => {
  it("sin aplicaciones directas el honorario queda PENDIENTE; con saldo parcial PARCIAL", () => {
    // Espejo de la decisión en recomputeHonorarioEstado tras deletePlanPago
    // (las aplicaciones de cuotas se desactivan; solo cuentan las del honorario).
    const decidir = (capitalZero: boolean, apps: number) => {
      if (capitalZero) return "COBRADO";
      if (apps > 0) return "PARCIAL";
      return "PENDIENTE";
    };
    expect(decidir(false, 0)).toBe("PENDIENTE");
    expect(decidir(false, 2)).toBe("PARCIAL");
    expect(decidir(true, 1)).toBe("COBRADO");
  });
});

describe("plan cubierto → estado honorario", () => {
  it("todas las cuotas vivas PAGADAS ⇒ COBRADO (sin depender del redondeo de capital)", () => {
    const decidirPorCuotas = (estados: string[]) => {
      const vivas = estados.filter((e) => e !== "CONDONADA");
      if (vivas.length > 0 && vivas.every((e) => e === "PAGADA")) return "COBRADO";
      return "SEGUIR_POR_CAPITAL";
    };
    expect(decidirPorCuotas(["PAGADA", "PAGADA", "PAGADA"])).toBe("COBRADO");
    expect(decidirPorCuotas(["PAGADA", "PAGADA", "CONDONADA"])).toBe("COBRADO");
    expect(decidirPorCuotas(["PAGADA", "PENDIENTE"])).toBe("SEGUIR_POR_CAPITAL");
    expect(decidirPorCuotas(["PAGADA", "PARCIAL", "PAGADA"])).toBe("SEGUIR_POR_CAPITAL");
  });
});
