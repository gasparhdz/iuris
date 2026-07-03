import { and, asc, desc, eq, getTableColumns, gte, ilike, isNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../index.js";
import { casos, clientes, ingresoAplicaciones, ingresos, parametros } from "../schema.js";

type NewIngreso = typeof ingresos.$inferInsert;
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | DbTransaction;

export interface IngresosFilters {
  casoId?: number;
  clienteId?: number;
  cuotaId?: number;
  from?: Date;
  to?: Date;
  search?: string;
  orderBy?: "fecha" | "concepto" | "cliente" | "expediente" | "monto";
  order?: "asc" | "desc";
}

export interface Pagination {
  limit: number;
  offset: number;
}

export class IngresosQueries {
  static async findIngresos(estudioId: number, filters: IngresosFilters, pagination: Pagination) {
    const { orderBy = "fecha", order = "desc" } = filters;
    const conditions = [
      eq(ingresos.estudioId, estudioId),
      eq(ingresos.activo, true),
      isNull(ingresos.deletedAt),
    ];

    if (filters.casoId) conditions.push(eq(ingresos.casoId, filters.casoId));
    if (filters.clienteId) conditions.push(eq(ingresos.clienteId, filters.clienteId));
    if (filters.cuotaId) conditions.push(eq(ingresos.cuotaId, filters.cuotaId));
    if (filters.from) conditions.push(gte(ingresos.fechaIngreso, filters.from));
    if (filters.to) conditions.push(lte(ingresos.fechaIngreso, filters.to));
    if (filters.search?.trim()) {
      conditions.push(ilike(ingresos.descripcion, `%${filters.search.trim()}%`));
    }

    const whereCondition = and(...conditions);

    const tipoParam = alias(parametros, "ingreso_tipo_sort");
    const sortDir = order === "desc" ? desc : asc;
    const clienteNombre = sql`COALESCE(${clientes.razonSocial}, CONCAT_WS(' ', ${clientes.nombre}, ${clientes.apellido}), '')`;
    const expedienteExpr = sql`COALESCE(${casos.caratula}, ${casos.nroExpte}, '')`;
    const conceptoExpr = sql`COALESCE(${tipoParam.nombre}, ${ingresos.descripcion}, '')`;
    const orderExpr = (() => {
      switch (orderBy) {
        case "concepto":
          return sortDir(conceptoExpr);
        case "cliente":
          return sortDir(clienteNombre);
        case "expediente":
          return sortDir(expedienteExpr);
        case "monto":
          return sortDir(ingresos.monto);
        case "fecha":
        default:
          return sortDir(ingresos.fechaIngreso);
      }
    })();

    const data = await db
      .select({
        id: ingresos.id,
        estudioId: ingresos.estudioId,
        clienteId: ingresos.clienteId,
        casoId: ingresos.casoId,
        cuotaId: ingresos.cuotaId,
        descripcion: ingresos.descripcion,
        monto: ingresos.monto,
        monedaId: ingresos.monedaId,
        cotizacionArs: ingresos.cotizacionArs,
        valorJusAlCobro: ingresos.valorJusAlCobro,
        fechaIngreso: ingresos.fechaIngreso,
        tipoId: ingresos.tipoId,
        estadoId: ingresos.estadoId,
        activo: ingresos.activo,
        createdAt: ingresos.createdAt,
        createdBy: ingresos.createdBy,
        updatedAt: ingresos.updatedAt,
        updatedBy: ingresos.updatedBy,
        deletedAt: ingresos.deletedAt,
        deletedBy: ingresos.deletedBy,
        jusAplicados: sql<number>`coalesce(sum(${ingresoAplicaciones.montoCapital} / nullif(${ingresoAplicaciones.valorJusAlCobro}, 0)), 0)`.mapWith(Number),
        montoAplicadoJusPesos: sql<number>`coalesce(sum(case when ${ingresoAplicaciones.valorJusAlCobro} is not null then ${ingresoAplicaciones.montoCapital} else 0 end), 0)`.mapWith(Number),
        montoAplicadoGastoPesos: sql<number>`coalesce(sum(case when ${ingresoAplicaciones.gastoId} is not null then ${ingresoAplicaciones.montoCapital} else 0 end), 0)`.mapWith(Number),
      })
      .from(ingresos)
      .leftJoin(clientes, eq(ingresos.clienteId, clientes.id))
      .leftJoin(casos, eq(ingresos.casoId, casos.id))
      .leftJoin(tipoParam, eq(ingresos.tipoId, tipoParam.id))
      .leftJoin(ingresoAplicaciones, and(eq(ingresoAplicaciones.ingresoId, ingresos.id), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt)))
      .where(whereCondition)
      .groupBy(ingresos.id, clientes.id, casos.id, tipoParam.id)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(orderExpr, asc(ingresos.id));

    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(ingresos)
      .where(whereCondition);

    return { data, count };
  }

  static async findIngresoById(id: number, estudioId: number, tx: DbExecutor = db) {
    const [row] = await tx
      .select()
      .from(ingresos)
      .where(and(eq(ingresos.id, id), eq(ingresos.estudioId, estudioId), eq(ingresos.activo, true), isNull(ingresos.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  static async updateIngreso(id: number, estudioId: number, data: Partial<NewIngreso>, tx: DbExecutor = db) {
    const [row] = await tx
      .update(ingresos)
      .set(data)
      .where(and(eq(ingresos.id, id), eq(ingresos.estudioId, estudioId), eq(ingresos.activo, true), isNull(ingresos.deletedAt)))
      .returning();

    return row ?? null;
  }

  static async deleteIngreso(id: number, estudioId: number, userId: number, tx: DbExecutor = db) {
    const [row] = await tx
      .update(ingresos)
      .set({ activo: false, deletedAt: new Date(), deletedBy: userId })
      .where(and(eq(ingresos.id, id), eq(ingresos.estudioId, estudioId), eq(ingresos.activo, true), isNull(ingresos.deletedAt)))
      .returning();

    return row ?? null;
  }
}
