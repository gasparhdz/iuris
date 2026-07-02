import { and, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../index.js";
import { gastos } from "../schema.js";

type NewGasto = typeof gastos.$inferInsert;
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | DbTransaction;

export interface GastosFilters {
  casoId?: number;
  clienteId?: number;
  from?: Date;
  to?: Date;
  search?: string;
}

export interface Pagination {
  limit: number;
  offset: number;
}

export class GastosQueries {
  static async findGastos(estudioId: number, filters: GastosFilters, pagination: Pagination) {
    const conditions = [
      eq(gastos.estudioId, estudioId),
      eq(gastos.activo, true),
      isNull(gastos.deletedAt),
    ];

    if (filters.casoId) conditions.push(eq(gastos.casoId, filters.casoId));
    if (filters.clienteId) conditions.push(eq(gastos.clienteId, filters.clienteId));
    if (filters.from) conditions.push(gte(gastos.fechaGasto, filters.from));
    if (filters.to) conditions.push(lte(gastos.fechaGasto, filters.to));
    if (filters.search?.trim()) {
      conditions.push(ilike(gastos.descripcion, `%${filters.search.trim()}%`));
    }

    const whereCondition = and(...conditions);

    const data = await db
      .select()
      .from(gastos)
      .where(whereCondition)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(gastos.fechaGasto);

    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(gastos)
      .where(whereCondition);

    return { data, count };
  }

  static async findGastoById(id: number, estudioId: number, tx: DbExecutor = db) {
    const [row] = await tx
      .select()
      .from(gastos)
      .where(and(eq(gastos.id, id), eq(gastos.estudioId, estudioId), eq(gastos.activo, true), isNull(gastos.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  static async updateGastoTx(id: number, estudioId: number, data: Partial<NewGasto>, tx: DbExecutor = db) {
    const [row] = await tx
      .update(gastos)
      .set(data)
      .where(and(eq(gastos.id, id), eq(gastos.estudioId, estudioId), eq(gastos.activo, true), isNull(gastos.deletedAt)))
      .returning();

    return row ?? null;
  }

  static async insertGasto(data: NewGasto) {
    const [row] = await db.insert(gastos).values(data).returning();
    return row;
  }

  static async updateGasto(id: number, estudioId: number, data: Partial<NewGasto>) {
    const [row] = await db
      .update(gastos)
      .set(data)
      .where(and(eq(gastos.id, id), eq(gastos.estudioId, estudioId), eq(gastos.activo, true), isNull(gastos.deletedAt)))
      .returning();

    return row ?? null;
  }

  static async deleteGasto(id: number, estudioId: number, userId: number) {
    const [row] = await db
      .update(gastos)
      .set({ activo: false, deletedAt: new Date(), deletedBy: userId })
      .where(and(eq(gastos.id, id), eq(gastos.estudioId, estudioId), eq(gastos.activo, true), isNull(gastos.deletedAt)))
      .returning();

    return row ?? null;
  }
}
