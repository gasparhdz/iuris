import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "../db/index.js";
import { systemErrorLogs } from "../db/schema.js";

export interface RegistrarErrorInput {
  nivel: "ERROR" | "WARN";
  statusCode: number;
  errorCode?: string;
  mensaje: string;
  metodo?: string;
  ruta?: string;
  ip?: string;
  usuarioId?: number;
  estudioId?: number;
  stackTrace?: string;
  contexto?: Record<string, unknown>;
}

export interface FiltrosErrorLogs {
  nivel?: string;
  statusCode?: number;
  desde?: string;
  hasta?: string;
  page?: number;
  limit?: number;
}

export const SystemErrorLogsService = {
  async registrar(input: RegistrarErrorInput): Promise<void> {
    try {
      await db.insert(systemErrorLogs).values({
        nivel: input.nivel,
        statusCode: input.statusCode,
        errorCode: input.errorCode,
        mensaje: input.mensaje.slice(0, 2000),
        metodo: input.metodo,
        ruta: input.ruta?.slice(0, 500),
        ip: input.ip,
        usuarioId: input.usuarioId,
        estudioId: input.estudioId,
        stackTrace: input.stackTrace ? input.stackTrace.slice(0, 5000) : undefined,
        contexto: input.contexto,
      });
    } catch {
      // Intencional: no romper el flujo del error handler por fallas de logging.
    }
  },

  async findAll(filtros: FiltrosErrorLogs) {
    const page = filtros.page ?? 1;
    const limit = filtros.limit ?? 50;
    const offset = (page - 1) * limit;
    const conditions: SQL[] = [];

    if (filtros.nivel) conditions.push(eq(systemErrorLogs.nivel, filtros.nivel));
    if (filtros.statusCode) conditions.push(eq(systemErrorLogs.statusCode, filtros.statusCode));
    if (filtros.desde) conditions.push(gte(systemErrorLogs.createdAt, new Date(filtros.desde)));
    if (filtros.hasta) {
      const hasta = new Date(filtros.hasta);
      hasta.setHours(23, 59, 59, 999);
      conditions.push(lte(systemErrorLogs.createdAt, hasta));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [items, [{ count }]] = await Promise.all([
      db
        .select()
        .from(systemErrorLogs)
        .where(where)
        .orderBy(desc(systemErrorLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(systemErrorLogs)
        .where(where),
    ]);

    return {
      items,
      meta: { total: count, page, limit },
    };
  },
};
