import { describe, expect, it } from "vitest";
import { hasPermiso } from "../auth/permissions.js";
import type { UserPermission } from "../db/queries/auth.queries.js";

function permiso(overrides: Partial<UserPermission> & { modulo: string }): UserPermission {
  return { ver: false, crear: false, editar: false, eliminar: false, ...overrides };
}

describe("hasPermiso (autorización fail-closed)", () => {
  it("sin permisos → deniega todo", () => {
    expect(hasPermiso([], "CLIENTES", "ver")).toBe(false);
    expect(hasPermiso([], "HONORARIOS", "crear")).toBe(false);
  });

  it("permite solo (modulo, accion) con la acción en true", () => {
    const permisos = [permiso({ modulo: "CLIENTES", ver: true, editar: true })];
    expect(hasPermiso(permisos, "CLIENTES", "ver")).toBe(true);
    expect(hasPermiso(permisos, "CLIENTES", "editar")).toBe(true);
  });

  it("la acción en false deniega aunque exista el módulo", () => {
    const permisos = [permiso({ modulo: "CLIENTES", ver: true })];
    expect(hasPermiso(permisos, "CLIENTES", "crear")).toBe(false);
    expect(hasPermiso(permisos, "CLIENTES", "eliminar")).toBe(false);
  });

  it("permiso de otro módulo no habilita el módulo consultado", () => {
    const permisos = [permiso({ modulo: "GASTOS", ver: true, crear: true })];
    expect(hasPermiso(permisos, "HONORARIOS", "ver")).toBe(false);
    expect(hasPermiso(permisos, "CLIENTES", "ver")).toBe(false);
  });

  it("resuelve correctamente con permisos de varios módulos", () => {
    const permisos = [
      permiso({ modulo: "CLIENTES", ver: true }),
      permiso({ modulo: "HONORARIOS", ver: true, crear: true, editar: true, eliminar: true }),
      permiso({ modulo: "EVENTOS", ver: false }),
    ];
    expect(hasPermiso(permisos, "CLIENTES", "ver")).toBe(true);
    expect(hasPermiso(permisos, "CLIENTES", "eliminar")).toBe(false);
    expect(hasPermiso(permisos, "HONORARIOS", "eliminar")).toBe(true);
    expect(hasPermiso(permisos, "EVENTOS", "ver")).toBe(false);
  });
});
