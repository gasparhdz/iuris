import { describe, expect, it } from "vitest";
import { assertAssignableEquipoRole } from "../controllers/equipo.controller.js";

describe("EQUIPO — roles de plataforma bloqueados", () => {
  it("rechaza SUPERADMIN y ADMIN", () => {
    expect(() => assertAssignableEquipoRole("SUPERADMIN")).toThrow("PLATFORM_ROLE_FORBIDDEN");
    expect(() => assertAssignableEquipoRole("ADMIN")).toThrow("PLATFORM_ROLE_FORBIDDEN");
    expect(() => assertAssignableEquipoRole("superadmin")).toThrow("PLATFORM_ROLE_FORBIDDEN");
  });

  it("rechaza roles fuera de la allowlist de tenant", () => {
    expect(() => assertAssignableEquipoRole("HACKER")).toThrow("PLATFORM_ROLE_FORBIDDEN");
    expect(() => assertAssignableEquipoRole("GOD")).toThrow("PLATFORM_ROLE_FORBIDDEN");
  });

  it("acepta roles de tenant válidos", () => {
    expect(assertAssignableEquipoRole("DIRECTOR")).toBe("DIRECTOR");
    expect(assertAssignableEquipoRole("ABOGADO")).toBe("ABOGADO");
    expect(assertAssignableEquipoRole("ASISTENTE")).toBe("ASISTENTE");
    expect(assertAssignableEquipoRole("asesor financiero")).toBe("ASESOR_FINANCIERO");
  });
});
