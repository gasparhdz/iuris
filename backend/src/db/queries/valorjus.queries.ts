import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "../index.js";
import { valoresJus } from "../schema.js";

type NewValorJus = typeof valoresJus.$inferInsert;
export const VALORES_JUS_ESTUDIO_GLOBAL_ID = 1;

export interface ValorJusPagination {
  limit: number;
  offset: number;
}

export class ValorJusQueries {
  static async findValorJusActual(estudioId: number) {
    const [row] = await db
      .select()
      .from(valoresJus)
      .where(and(eq(valoresJus.estudioId, VALORES_JUS_ESTUDIO_GLOBAL_ID), eq(valoresJus.activo, true), isNull(valoresJus.deletedAt)))
      .orderBy(desc(valoresJus.fecha))
      .limit(1);

    return row ?? null;
  }

  static async findValorJusByFecha(fecha: Date, estudioId: number) {
    const [historico] = await db
      .select()
      .from(valoresJus)
      .where(
        and(
          eq(valoresJus.estudioId, VALORES_JUS_ESTUDIO_GLOBAL_ID),
          eq(valoresJus.activo, true),
          isNull(valoresJus.deletedAt),
          lte(valoresJus.fecha, fecha)
        )
      )
      .orderBy(desc(valoresJus.fecha))
      .limit(1);

    return historico ?? null;
  }

  static async findValoresJus(estudioId: number, filters: { from?: Date; to?: Date }, pagination: ValorJusPagination) {
    const conditions = [
      eq(valoresJus.estudioId, VALORES_JUS_ESTUDIO_GLOBAL_ID),
      isNull(valoresJus.deletedAt),
    ];

    if (filters.from) conditions.push(gte(valoresJus.fecha, filters.from));
    if (filters.to) conditions.push(lte(valoresJus.fecha, filters.to));

    const whereCondition = and(...conditions);

    const data = await db
      .select()
      .from(valoresJus)
      .where(whereCondition)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(desc(valoresJus.fecha));

    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(valoresJus)
      .where(whereCondition);

    return { data, count };
  }

  static async insertValorJus(values: NewValorJus) {
    try {
      const [row] = await db.insert(valoresJus).values({ ...values, estudioId: VALORES_JUS_ESTUDIO_GLOBAL_ID }).returning();
      return row;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) throw new Error("VALOR_JUS_DUPLICATE_FECHA");
      throw error;
    }
  }

  static async insertValoresJus(values: NewValorJus[]) {
    if (values.length === 0) return [];

    return await db
      .insert(valoresJus)
      .values(values.map((value) => ({ ...value, estudioId: VALORES_JUS_ESTUDIO_GLOBAL_ID })))
      .onConflictDoNothing()
      .returning();
  }

  /** Historial completo de valores activos, ascendente por fecha (para ajustes de CC). */
  static async findHistorialActivo(estudioId = VALORES_JUS_ESTUDIO_GLOBAL_ID) {
    return await db
      .select({ fecha: valoresJus.fecha, valor: valoresJus.valor })
      .from(valoresJus)
      .where(and(eq(valoresJus.estudioId, estudioId), eq(valoresJus.activo, true), isNull(valoresJus.deletedAt)))
      .orderBy(valoresJus.fecha);
  }

  static async findMaxFechaActiva(estudioId = VALORES_JUS_ESTUDIO_GLOBAL_ID) {
    const [row] = await db
      .select({
        fecha: sql<Date | string | null>`max(${valoresJus.fecha})`.mapWith((value) => {
          if (!value) return null;
          return value instanceof Date ? value : new Date(value);
        }),
      })
      .from(valoresJus)
      .where(and(eq(valoresJus.estudioId, estudioId), eq(valoresJus.activo, true), isNull(valoresJus.deletedAt)));

    return row?.fecha ?? null;
  }

  static async updateValorJus(id: number, estudioId: number, values: Partial<NewValorJus>) {
    const [row] = await db
      .update(valoresJus)
      .set(values)
      .where(and(eq(valoresJus.id, id), eq(valoresJus.estudioId, VALORES_JUS_ESTUDIO_GLOBAL_ID), isNull(valoresJus.deletedAt)))
      .returning();

    return row ?? null;
  }

  static async deleteValorJus(id: number, estudioId: number) {
    const [row] = await db
      .update(valoresJus)
      .set({ deletedAt: new Date(), activo: false })
      .where(and(eq(valoresJus.id, id), eq(valoresJus.estudioId, VALORES_JUS_ESTUDIO_GLOBAL_ID), isNull(valoresJus.deletedAt)))
      .returning();

    return row ?? null;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code: unknown }).code === "23505";
}
