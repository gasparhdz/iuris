import type { UserPermission } from "../db/queries/auth.queries.js";

export type AccionPermiso = "ver" | "crear" | "editar" | "eliminar";

/**
 * Decisión PURA de autorización (fail-closed): un usuario tiene permiso para (modulo, accion)
 * solo si existe un permiso explícito con ese módulo y esa acción en `true`. Sin coincidencia
 * → false. Centralizado acá (en vez de repetir el `.some(...)` inline en el plugin y en el
 * buscador) para tener una sola definición testeable de la regla.
 *
 * `import type` arriba: no arrastra dependencias de runtime (DB), así es testeable sin entorno.
 */
export function hasPermiso(
  permisos: readonly UserPermission[],
  modulo: string,
  accion: AccionPermiso,
): boolean {
  return permisos.some((p) => p.modulo === modulo && p[accion] === true);
}
