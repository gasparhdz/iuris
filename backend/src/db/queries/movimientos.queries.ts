import { and, asc, desc, eq, getTableColumns, isNotNull, isNull } from "drizzle-orm";
import { db } from "../index.js";
import { movimientosJudiciales, tareas } from "../schema.js";

type NewMovimiento = typeof movimientosJudiciales.$inferInsert;

export class MovimientosQueries {
  static async findMovimientosByCaso(casoId: number, estudioId: number) {
    // Por cada movimiento, su tarea-plazo vinculada (la tarea ES el plazo): la activa/no
    // completada con vencimiento más próximo. DISTINCT ON (movimiento) deja una sola por
    // movimiento. Permite mostrar el chip de vencimiento sin duplicar la fecha en el movimiento.
    const tareaPorMov = db
      .selectDistinctOn([tareas.movimientoId], {
        movimientoId: tareas.movimientoId,
        tareaId: tareas.id,
        tareaVencimiento: tareas.fechaLimite,
      })
      .from(tareas)
      .where(and(
        isNotNull(tareas.movimientoId),
        eq(tareas.completada, false),
        eq(tareas.activo, true),
        isNull(tareas.deletedAt),
      ))
      .orderBy(tareas.movimientoId, asc(tareas.fechaLimite))
      .as("tarea_por_mov");

    return await db
      .select({
        ...getTableColumns(movimientosJudiciales),
        tareaId: tareaPorMov.tareaId,
        tareaVencimiento: tareaPorMov.tareaVencimiento,
      })
      .from(movimientosJudiciales)
      .leftJoin(tareaPorMov, eq(tareaPorMov.movimientoId, movimientosJudiciales.id))
      .where(and(eq(movimientosJudiciales.casoId, casoId), eq(movimientosJudiciales.estudioId, estudioId)))
      .orderBy(desc(movimientosJudiciales.fecha));
  }

  static async insertMovimiento(data: Omit<NewMovimiento, "estudioId">, estudioId: number) {
    const [row] = await db
      .insert(movimientosJudiciales)
      .values({ ...data, estudioId })
      .returning();

    return row;
  }

  static async updateMovimiento(id: number, data: Partial<NewMovimiento>, estudioId: number) {
    const [row] = await db
      .update(movimientosJudiciales)
      .set(data)
      .where(and(eq(movimientosJudiciales.id, id), eq(movimientosJudiciales.estudioId, estudioId)))
      .returning();

    return row ?? null;
  }

  static async deleteMovimiento(id: number, estudioId: number) {
    const [row] = await db
      .delete(movimientosJudiciales)
      .where(and(eq(movimientosJudiciales.id, id), eq(movimientosJudiciales.estudioId, estudioId)))
      .returning();

    return row ?? null;
  }
}
