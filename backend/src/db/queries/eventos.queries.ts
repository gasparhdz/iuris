import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "../index.js";
import { eventos } from "../schema.js";

type NewEvento = typeof eventos.$inferInsert;

export class EventosQueries {
  static async findAll(estudioId: number, limit: number, offset: number, from?: Date, to?: Date) {
    const conditions = [
      eq(eventos.estudioId, estudioId),
      isNull(eventos.deletedAt),
    ];

    if (from) conditions.push(gte(eventos.fechaInicio, from));
    if (to) conditions.push(lte(eventos.fechaInicio, to));

    const whereCondition = and(...conditions);

    const data = await db
      .select()
      .from(eventos)
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(eventos.fechaInicio);

    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(eventos)
      .where(whereCondition);

    return { data, count };
  }

  static async findById(id: number, estudioId: number) {
    const [evento] = await db
      .select()
      .from(eventos)
      .where(and(eq(eventos.id, id), eq(eventos.estudioId, estudioId), isNull(eventos.deletedAt)))
      .limit(1);

    return evento ?? null;
  }

  static async insert(values: NewEvento) {
    const [row] = await db.insert(eventos).values(values).returning();
    return row;
  }

  static async update(id: number, estudioId: number, values: Partial<NewEvento>) {
    const [row] = await db
      .update(eventos)
      .set(values)
      .where(and(eq(eventos.id, id), eq(eventos.estudioId, estudioId)))
      .returning();
    return row;
  }

  static async softDelete(id: number, estudioId: number, userId: number) {
    const [row] = await db
      .update(eventos)
      .set({ deletedAt: new Date(), deletedBy: userId, activo: false })
      .where(and(eq(eventos.id, id), eq(eventos.estudioId, estudioId), isNull(eventos.deletedAt)))
      .returning();

    return row ?? null;
  }

  static async findInRange(estudioId: number, from: Date, to: Date) {
    return await db
      .select()
      .from(eventos)
      .where(
        and(
          eq(eventos.estudioId, estudioId),
          isNull(eventos.deletedAt),
          gte(eventos.fechaInicio, from),
          lte(eventos.fechaInicio, to)
        )
      );
  }
}
