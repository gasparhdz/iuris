import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "../index.js";
import { terceros } from "../schema.js";

type NewTercero = typeof terceros.$inferInsert;

export class TercerosQueries {
  static async findAll(estudioId: number, limit: number, offset: number, search?: string) {
    let whereCondition = and(eq(terceros.estudioId, estudioId), isNull(terceros.deletedAt));

    if (search) {
      whereCondition = and(
        whereCondition,
        or(
          ilike(terceros.nombre, `%${search}%`),
          ilike(terceros.apellido, `%${search}%`),
          ilike(terceros.razonSocial, `%${search}%`),
          ilike(terceros.dni, `%${search}%`),
          ilike(terceros.cuit, `%${search}%`),
          ilike(terceros.email, `%${search}%`)
        )
      ) ?? whereCondition;
    }

    const data = await db
      .select()
      .from(terceros)
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(terceros.id);

    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(terceros)
      .where(whereCondition);

    return { data, count };
  }

  static async findById(id: number, estudioId: number) {
    const [tercero] = await db
      .select()
      .from(terceros)
      .where(and(eq(terceros.id, id), eq(terceros.estudioId, estudioId), isNull(terceros.deletedAt)))
      .limit(1);

    return tercero ?? null;
  }

  static async insert(values: NewTercero) {
    const [row] = await db.insert(terceros).values(values).returning();
    return row;
  }

  static async update(id: number, estudioId: number, values: Partial<NewTercero>) {
    const [row] = await db
      .update(terceros)
      .set(values)
      .where(and(eq(terceros.id, id), eq(terceros.estudioId, estudioId)))
      .returning();
    return row;
  }

  static async delete(id: number, estudioId: number, userId: number) {
    const [row] = await db
      .update(terceros)
      .set({ deletedAt: new Date(), deletedBy: userId, activo: false })
      .where(and(eq(terceros.id, id), eq(terceros.estudioId, estudioId), isNull(terceros.deletedAt)))
      .returning();
    return row;
  }
}
