import { and, asc, desc, eq, getTableColumns, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../index.js";
import { casos, clientes, gastos, parametros } from "../schema.js";

type NewGasto = typeof gastos.$inferInsert;
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | DbTransaction;

export interface GastosFilters {
  casoId?: number;
  clienteId?: number;
  from?: Date;
  to?: Date;
  search?: string;
  orderBy?: "fecha" | "concepto" | "cliente" | "expediente" | "monto" | "estado";
  order?: "asc" | "desc";
}

export interface Pagination {
  limit: number;
  offset: number;
}

export class GastosQueries {
  static async findGastos(estudioId: number, filters: GastosFilters, pagination: Pagination) {
    const { orderBy = "fecha", order = "desc" } = filters;
    const conceptoParam = alias(parametros, "gasto_concepto_sort");
    const estadoParam = alias(parametros, "gasto_estado_sort");
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
      const q = `%${filters.search.trim()}%`;
      conditions.push(or(
        ilike(gastos.descripcion, q),
        ilike(clientes.nombre, q),
        ilike(clientes.apellido, q),
        ilike(clientes.razonSocial, q),
        ilike(casos.caratula, q),
        ilike(conceptoParam.nombre, q),
      )!);
    }

    const whereCondition = and(...conditions);

    const sortDir = order === "desc" ? desc : asc;
    const clienteNombre = sql`COALESCE(${clientes.razonSocial}, CONCAT_WS(' ', ${clientes.nombre}, ${clientes.apellido}), '')`;
    const expedienteExpr = sql`COALESCE(${casos.caratula}, ${casos.nroExpte}, '')`;
    const conceptoExpr = sql`COALESCE(${conceptoParam.nombre}, ${gastos.descripcion}, '')`;
    const orderExpr = (() => {
      switch (orderBy) {
        case "concepto":
          return sortDir(conceptoExpr);
        case "cliente":
          return sortDir(clienteNombre);
        case "expediente":
          return sortDir(expedienteExpr);
        case "monto":
          return sortDir(gastos.monto);
        case "estado":
          return sortDir(estadoParam.nombre);
        case "fecha":
        default:
          return sortDir(gastos.fechaGasto);
      }
    })();

    const data = await db
      .select(getTableColumns(gastos))
      .from(gastos)
      .leftJoin(clientes, eq(gastos.clienteId, clientes.id))
      .leftJoin(casos, eq(gastos.casoId, casos.id))
      .leftJoin(conceptoParam, eq(gastos.conceptoId, conceptoParam.id))
      .leftJoin(estadoParam, eq(gastos.estadoId, estadoParam.id))
      .where(whereCondition)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(orderExpr, asc(gastos.id));

    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(gastos)
      .leftJoin(clientes, eq(gastos.clienteId, clientes.id))
      .leftJoin(casos, eq(gastos.casoId, casos.id))
      .leftJoin(conceptoParam, eq(gastos.conceptoId, conceptoParam.id))
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
