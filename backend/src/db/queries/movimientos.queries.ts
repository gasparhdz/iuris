import { and, desc, eq } from "drizzle-orm";
import { db } from "../index.js";
import { movimientosJudiciales } from "../schema.js";

type NewMovimiento = typeof movimientosJudiciales.$inferInsert;

export class MovimientosQueries {
  static async findMovimientosByCaso(casoId: number, estudioId: number) {
    return await db
      .select()
      .from(movimientosJudiciales)
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
