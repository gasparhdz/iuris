import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../index.js";
import { auditoriaLogs, usuarios } from "../schema.js";

export interface AuditoriaFilter {
  entidad?: string;
  entidadId?: number;
  usuarioId?: number;
  desde?: Date;
  hasta?: Date;
  page?: number;
  limit?: number;
}

export class AuditoriaQueries {
  static async insert(values: typeof auditoriaLogs.$inferInsert) {
    const [row] = await db.insert(auditoriaLogs).values(values).returning();
    return row;
  }

  static async findAll(estudioId: number, filter: AuditoriaFilter = {}) {
    const { entidad, entidadId, usuarioId, desde, hasta, page = 1, limit = 50 } = filter;
    const offset = (page - 1) * limit;
    const conditions = [eq(auditoriaLogs.estudioId, estudioId)];

    if (entidad) conditions.push(eq(auditoriaLogs.entidad, entidad));
    if (entidadId) conditions.push(eq(auditoriaLogs.entidadId, entidadId));
    if (usuarioId) conditions.push(eq(auditoriaLogs.usuarioId, usuarioId));
    if (desde) conditions.push(gte(auditoriaLogs.createdAt, desde));
    if (hasta) conditions.push(lte(auditoriaLogs.createdAt, hasta));

    const whereCondition = and(...conditions);

    const data = await db
      .select({
        log: auditoriaLogs,
        usuarioNombre: sql<string>`concat(${usuarios.nombre}, ' ', ${usuarios.apellido})`,
      })
      .from(auditoriaLogs)
      .leftJoin(usuarios, eq(auditoriaLogs.usuarioId, usuarios.id))
      .where(whereCondition)
      .orderBy(desc(auditoriaLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(auditoriaLogs)
      .where(whereCondition);

    return { data, count };
  }

  // Historial completo de un expediente: logs propios del caso + entidades vinculadas.
  static async findByExpediente(estudioId: number, casoId: number, limit = 100) {
    return await db
      .select({
        log: auditoriaLogs,
        usuarioNombre: sql<string>`concat(${usuarios.nombre}, ' ', ${usuarios.apellido})`,
      })
      .from(auditoriaLogs)
      .leftJoin(usuarios, eq(auditoriaLogs.usuarioId, usuarios.id))
      .where(
        and(
          eq(auditoriaLogs.estudioId, estudioId),
          eq(auditoriaLogs.entidad, "caso"),
          eq(auditoriaLogs.entidadId, casoId)
        )
      )
      .orderBy(desc(auditoriaLogs.createdAt))
      .limit(limit);
  }
}
