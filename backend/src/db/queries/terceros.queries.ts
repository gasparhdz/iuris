import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "../index.js";
import { casos, participantesCaso, terceros } from "../schema.js";
import { personaNombreSortExpr } from "../sql/personaNombre.js";

type NewTercero = typeof terceros.$inferInsert;

type TerceroListFilters = {
  search?: string;
  orderBy?: "nombre" | "dni" | "tipo";
  order?: "asc" | "desc";
};

export class TercerosQueries {
  static async findAll(
    estudioId: number,
    limit: number,
    offset: number,
    filters: TerceroListFilters = {},
  ) {
    const { search, orderBy = "nombre", order = "asc" } = filters;
    let whereCondition = and(eq(terceros.estudioId, estudioId), isNull(terceros.deletedAt));

    if (search) {
      const term = `%${search}%`;
      whereCondition = and(
        whereCondition,
        or(
          ilike(terceros.nombre, term),
          ilike(terceros.apellido, term),
          ilike(terceros.razonSocial, term),
          ilike(terceros.dni, term),
          ilike(terceros.cuit, term),
          ilike(terceros.email, term),
          ilike(terceros.telefono, term),
        )
      ) ?? whereCondition;
    }

    const sortDir = order === "desc" ? desc : asc;
    const orderExpr = (() => {
      switch (orderBy) {
        case "dni":
          return sortDir(sql`COALESCE(${terceros.cuit}, ${terceros.dni}, '')`);
        case "tipo":
          return sortDir(terceros.tipoPersonaId);
        case "nombre":
        default:
          return sortDir(personaNombreSortExpr(terceros.razonSocial, terceros.apellido, terceros.nombre));
      }
    })();

    const data = await db
      .select()
      .from(terceros)
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(orderExpr, asc(terceros.id));

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

  static async countParticipacionesActivas(terceroId: number, estudioId: number) {
    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(participantesCaso)
      .innerJoin(casos, eq(participantesCaso.casoId, casos.id))
      .where(and(
        eq(participantesCaso.terceroId, terceroId),
        eq(participantesCaso.estudioId, estudioId),
        eq(casos.estudioId, estudioId),
        isNull(casos.deletedAt),
      ));

    return count;
  }

  static async insert(values: NewTercero) {
    const [row] = await db.insert(terceros).values(values).returning();
    return row;
  }

  static async update(id: number, estudioId: number, values: Partial<NewTercero>) {
    const [row] = await db
      .update(terceros)
      .set(values)
      .where(and(eq(terceros.id, id), eq(terceros.estudioId, estudioId), isNull(terceros.deletedAt)))
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
