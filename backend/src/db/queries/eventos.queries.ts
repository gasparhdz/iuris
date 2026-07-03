import { and, asc, desc, eq, getTableColumns, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../index.js";
import { casos, clientes, eventos, parametros } from "../schema.js";

type NewEvento = typeof eventos.$inferInsert;

type EventoListFilters = {
  from?: Date;
  to?: Date;
  search?: string;
  tipoId?: number;
  estadoId?: number;
  upcoming?: boolean;
  orderBy?: "evento" | "tipoEstado" | "fechas" | "vinculaciones" | "ubicacion";
  order?: "asc" | "desc";
};

export class EventosQueries {
  static async findAll(
    estudioId: number,
    limit: number,
    offset: number,
    filters: EventoListFilters = {},
  ) {
    const { from, to, search, tipoId, estadoId, upcoming, orderBy = "fechas", order = "asc" } = filters;
    const conditions = [
      eq(eventos.estudioId, estudioId),
      isNull(eventos.deletedAt),
    ];

    if (from) conditions.push(gte(eventos.fechaInicio, from));
    if (to) conditions.push(lte(eventos.fechaInicio, to));
    if (tipoId) conditions.push(eq(eventos.tipoId, tipoId));
    if (estadoId) conditions.push(eq(eventos.estadoId, estadoId));
    if (upcoming === true) conditions.push(gte(eventos.fechaInicio, new Date()));
    if (upcoming === false) conditions.push(lte(eventos.fechaInicio, new Date()));
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(
        ilike(eventos.descripcion, term),
        ilike(eventos.observaciones, term),
        ilike(eventos.ubicacion, term),
      )!);
    }

    const whereCondition = and(...conditions);

    const tipoParam = alias(parametros, "evento_tipo_sort");
    const estadoParam = alias(parametros, "evento_estado_sort");
    const sortDir = order === "desc" ? desc : asc;
    const clienteNombre = sql`COALESCE(${clientes.razonSocial}, CONCAT_WS(' ', ${clientes.nombre}, ${clientes.apellido}), '')`;
    const vinculacionExpr = sql`trim(concat_ws(' ', ${clienteNombre}, coalesce(${casos.caratula}, ${casos.nroExpte}, '')))`;
    const orderExpr = (() => {
      switch (orderBy) {
        case "evento":
          return sortDir(eventos.descripcion);
        case "tipoEstado":
          return sortDir(sql`concat_ws(' ', ${tipoParam.nombre}, ${estadoParam.nombre})`);
        case "vinculaciones":
          return sortDir(vinculacionExpr);
        case "ubicacion":
          return sortDir(eventos.ubicacion);
        case "fechas":
        default:
          return sortDir(eventos.fechaInicio);
      }
    })();

    const data = await db
      .select(getTableColumns(eventos))
      .from(eventos)
      .leftJoin(clientes, eq(eventos.clienteId, clientes.id))
      .leftJoin(casos, eq(eventos.casoId, casos.id))
      .leftJoin(tipoParam, eq(eventos.tipoId, tipoParam.id))
      .leftJoin(estadoParam, eq(eventos.estadoId, estadoParam.id))
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(orderExpr, asc(eventos.id));

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
