import { AuditoriaQueries } from "../db/queries/auditoria.queries.js";
import { logger } from "../utils/logger.js";

export type AuditoriaEntidad = "caso" | "cliente" | "tarea" | "evento" | "ingreso" | "gasto" | "honorario";
export type AuditoriaAccion = "CREATE" | "UPDATE" | "DELETE" | "ESTADO_CHANGED" | "COMPLETADA";

export interface LogAuditoriaInput {
  estudioId: number;
  usuarioId: number;
  entidad: AuditoriaEntidad;
  entidadId: number;
  accion: AuditoriaAccion;
  descripcion?: string;
  cambios?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  ip?: string;
}

const EXCLUDED_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "deletedAt",
  "createdBy",
  "updatedBy",
  "deletedBy",
  "activo",
  "nroExpteNorm",
  "passwordHash",
]);

export function calcDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const beforeDiff: Record<string, unknown> = {};
  const afterDiff: Record<string, unknown> = {};

  for (const key of Object.keys(after)) {
    if (EXCLUDED_FIELDS.has(key)) continue;

    const bVal = before[key] ?? null;
    const aVal = after[key] ?? null;

    if (String(bVal) !== String(aVal)) {
      beforeDiff[key] = bVal;
      afterDiff[key] = aVal;
    }
  }

  if (Object.keys(afterDiff).length === 0) return null;
  return { before: beforeDiff, after: afterDiff };
}

export class AuditoriaService {
  static async log(input: LogAuditoriaInput): Promise<void> {
    try {
      await AuditoriaQueries.insert({
        estudioId: input.estudioId,
        usuarioId: input.usuarioId,
        entidad: input.entidad,
        entidadId: input.entidadId,
        accion: input.accion,
        descripcion: input.descripcion ?? null,
        cambios: input.cambios ?? null,
        ip: input.ip ?? null,
      });
    } catch (err) {
      logger.error({ err }, "[AuditoriaService] Error al registrar log");
    }
  }
}
