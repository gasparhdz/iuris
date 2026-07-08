import { describe, expect, it } from "vitest";
import { mapaTipoMovimiento } from "../services/sisfe-movimiento.mapper.js";

describe("mapaTipoMovimiento", () => {
  it("CARGO → Escrito", () => {
    expect(mapaTipoMovimiento({ tabla: "CARGO", tipoActuacion: null, actuacionTipoFirma: null })).toBe("Escrito");
  });

  it("ACTUACION tipo 1 → Resolución/Sentencia", () => {
    expect(mapaTipoMovimiento({ tabla: "ACTUACION", tipoActuacion: 1, actuacionTipoFirma: 1 })).toBe("Resolución/Sentencia");
  });

  it("ACTUACION tipo 3 con firma → Notificación con firma digital", () => {
    expect(mapaTipoMovimiento({ tabla: "ACTUACION", tipoActuacion: 3, actuacionTipoFirma: 1 })).toBe("Notificación con firma digital");
  });

  it("ACTUACION tipo 3 sin firma → Trámite", () => {
    expect(mapaTipoMovimiento({ tabla: "ACTUACION", tipoActuacion: 3, actuacionTipoFirma: 0 })).toBe("Trámite");
  });

  it("ACTUACION tipo 0 con firma → Trámite", () => {
    expect(mapaTipoMovimiento({ tabla: "ACTUACION", tipoActuacion: 0, actuacionTipoFirma: 1 })).toBe("Trámite");
  });

  it("ACTUACION tipo 0 sin firma → Trámite", () => {
    expect(mapaTipoMovimiento({ tabla: "ACTUACION", tipoActuacion: 0, actuacionTipoFirma: null })).toBe("Trámite");
  });
});
