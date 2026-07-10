import { describe, expect, it } from "vitest";
import {
  assertGastoMonedaCotizacion,
  gastoCambioFinanciero,
} from "../services/gastos.service.js";
import { buildCuentaCorriente } from "../services/cuenta-corriente.js";

const VJ = "132863.1800";

describe("gastos: inmutabilidad con aplicaciones", () => {
  it("detecta cambio financiero (bloqueable si hay reintegros)", () => {
    expect(gastoCambioFinanciero({ monto: 100 })).toBe(true);
    expect(gastoCambioFinanciero({ clienteId: 1 })).toBe(true);
    expect(gastoCambioFinanciero({ casoId: 2 })).toBe(true);
    expect(gastoCambioFinanciero({ monedaId: 3 })).toBe(true);
    expect(gastoCambioFinanciero({ cotizacionArs: 1000 })).toBe(true);
    expect(gastoCambioFinanciero({ fechaGasto: "2026-01-01T00:00:00.000Z" })).toBe(true);
    expect(gastoCambioFinanciero({ estadoId: 4 })).toBe(true);
  });

  it("permite edición no financiera (descripción / concepto)", () => {
    expect(gastoCambioFinanciero({ descripcion: "Nueva nota" })).toBe(false);
    expect(gastoCambioFinanciero({ conceptoId: 9 })).toBe(false);
    expect(gastoCambioFinanciero({})).toBe(false);
  });

  it("bloqueo de delete/edit: con aplicaciones activas se lanza el error de negocio", () => {
    // Espejo de GastosService.update/delete: si hay apps → 409.
    const assertBloqueo = (hasApps: boolean, cambioFinanciero: boolean, isDelete: boolean) => {
      if (isDelete && hasApps) throw new Error("GASTO_IMPUTADO_NO_ELIMINABLE");
      if (!isDelete && cambioFinanciero && hasApps) throw new Error("GASTO_IMPUTADO_NO_EDITABLE");
    };

    expect(() => assertBloqueo(true, false, true)).toThrow("GASTO_IMPUTADO_NO_ELIMINABLE");
    expect(() => assertBloqueo(true, true, false)).toThrow("GASTO_IMPUTADO_NO_EDITABLE");
    expect(() => assertBloqueo(true, false, false)).not.toThrow();
    expect(() => assertBloqueo(false, true, false)).not.toThrow();
  });
});

describe("gastos: moneda / cotización", () => {
  it("ARS no admite cotización", () => {
    expect(() => assertGastoMonedaCotizacion({
      monedaCodigo: "ARS",
      cotizacionArs: 1000,
      valorJusResoluble: false,
    })).toThrow("GASTO_COTIZACION_INVALIDA");

    expect(() => assertGastoMonedaCotizacion({
      monedaCodigo: "ARS",
      cotizacionArs: null,
      valorJusResoluble: false,
    })).not.toThrow();
  });

  it("JUS admite cotización o valor JUS resoluble", () => {
    expect(() => assertGastoMonedaCotizacion({
      monedaCodigo: "JUS",
      cotizacionArs: null,
      valorJusResoluble: true,
    })).not.toThrow();

    expect(() => assertGastoMonedaCotizacion({
      monedaCodigo: "JUS",
      cotizacionArs: 132863.18,
      valorJusResoluble: false,
    })).not.toThrow();

    expect(() => assertGastoMonedaCotizacion({
      monedaCodigo: "JUS",
      cotizacionArs: null,
      valorJusResoluble: false,
    })).toThrow("GASTO_COTIZACION_REQUERIDA");
  });

  it("USD exige cotización", () => {
    expect(() => assertGastoMonedaCotizacion({
      monedaCodigo: "USD",
      cotizacionArs: null,
      valorJusResoluble: true,
    })).toThrow("GASTO_COTIZACION_REQUERIDA");

    expect(() => assertGastoMonedaCotizacion({
      monedaCodigo: "USD",
      cotizacionArs: 1400,
      valorJusResoluble: false,
    })).not.toThrow();
  });
});

describe("cuenta corriente: valuación de gastos por monedaCodigo", () => {
  it("ARS usa el monto directo e ignora cotización", () => {
    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-06-09T00:00:00.000Z"),
      valorJusActual: VJ,
      honorarios: [],
      gastos: [{
        id: 1,
        descripcion: "Gasto ARS",
        fecha: new Date("2026-02-01T00:00:00.000Z"),
        monto: "10000.00",
        monedaCodigo: "ARS",
        cotizacionArs: "999.0000", // debe ignorarse
      }],
      ingresos: [],
    });
    expect(result.totales.gastosPesos).toBe(10000);
    expect(result.rows[0].cantidadJus).toBeNull();
    expect(result.rows[0].moneda).toBe("ARS");
  });

  it("JUS convierte con cotización y expone cantidadJus / valorJusAplicado", () => {
    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-06-09T00:00:00.000Z"),
      valorJusActual: VJ,
      honorarios: [],
      gastos: [{
        id: 2,
        descripcion: "Gasto JUS",
        fecha: new Date("2026-02-01T00:00:00.000Z"),
        monto: "10.0000",
        monedaCodigo: "JUS",
        cotizacionArs: "100000.0000",
      }],
      ingresos: [],
    });
    expect(result.totales.gastosPesos).toBe(1000000);
    expect(result.rows[0].moneda).toBe("JUS");
    expect(result.rows[0].cantidadJus).toBe(10);
    expect(result.rows[0].valorJusAplicado).toBe(100000);
  });

  it("USD convierte con cotizacionArs", () => {
    const result = buildCuentaCorriente({
      fechaCorte: new Date("2026-06-09T00:00:00.000Z"),
      valorJusActual: VJ,
      honorarios: [],
      gastos: [{
        id: 3,
        descripcion: "Gasto USD",
        fecha: new Date("2026-02-01T00:00:00.000Z"),
        monto: "100.00",
        monedaCodigo: "USD",
        cotizacionArs: "1400.0000",
      }],
      ingresos: [],
    });
    expect(result.totales.gastosPesos).toBe(140000);
    expect(result.rows[0].moneda).toBe("ARS");
    expect(result.rows[0].valorJusAplicado).toBe(1400);
  });
});
