import { and, asc, desc, eq, exists, getTableColumns, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../index.js";
import { casos, clientes, gastos, ingresoAplicaciones, ingresos, parametros, planCuotas, planesPago, terceros, honorarios } from "../schema.js";
import { personaNombreSortExpr, vinculacionExpteClienteSortExpr } from "../sql/personaNombre.js";
import { honorarioDeudorSqlCondition } from "./honorarios.queries.js";

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
    const tipoParam = alias(parametros, "ingreso_tipo_sort");
    const obligadoCliente = alias(clientes, "ingreso_obligado_cliente");
    const obligadoTercero = alias(terceros, "ingreso_obligado_tercero");

    if (filters.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(or(
        ilike(ingresos.descripcion, term),
        ilike(clientes.nombre, term),
        ilike(clientes.apellido, term),
        ilike(clientes.razonSocial, term),
        ilike(obligadoCliente.nombre, term),
        ilike(obligadoCliente.apellido, term),
        ilike(obligadoCliente.razonSocial, term),
        ilike(obligadoTercero.nombre, term),
        ilike(obligadoTercero.apellido, term),
        ilike(obligadoTercero.razonSocial, term),
        ilike(casos.caratula, term),
        ilike(casos.nroExpte, term),
      )!);
    }

    const whereCondition = and(...conditions);
    const obligadoNombreExpr = sql<string | null>`CASE
      WHEN ${ingresos.obligadoTerceroId} IS NOT NULL THEN
        COALESCE(
          ${obligadoTercero.razonSocial},
          NULLIF(CONCAT_WS(', ', ${obligadoTercero.apellido}, ${obligadoTercero.nombre}), ''),
          ${obligadoTercero.nombre}
        )
      WHEN ${ingresos.obligadoClienteId} IS NOT NULL THEN
        COALESCE(
          ${obligadoCliente.razonSocial},
          NULLIF(CONCAT_WS(', ', ${obligadoCliente.apellido}, ${obligadoCliente.nombre}), ''),
          ${obligadoCliente.nombre}
        )
      ELSE NULL
    END`;
    const sortDir = order === "desc" ? desc : asc;
    const clienteNombre = personaNombreSortExpr(clientes.razonSocial, clientes.apellido, clientes.nombre);
    const expedienteExpr = vinculacionExpteClienteSortExpr(
      casos.caratula,
      clientes.razonSocial,
      clientes.apellido,
      clientes.nombre,
    );
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
        obligadoClienteId: ingresos.obligadoClienteId,
        obligadoTerceroId: ingresos.obligadoTerceroId,
        obligadoNombre: obligadoNombreExpr,
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
      // join solo para ordenar/filtrar; NO se proyecta
      .leftJoin(clientes, eq(ingresos.clienteId, clientes.id))
      // join solo para ordenar/filtrar; NO se proyecta
      .leftJoin(casos, eq(ingresos.casoId, casos.id))
      .leftJoin(tipoParam, eq(ingresos.tipoId, tipoParam.id))
      .leftJoin(obligadoCliente, eq(ingresos.obligadoClienteId, obligadoCliente.id))
      .leftJoin(obligadoTercero, eq(ingresos.obligadoTerceroId, obligadoTercero.id))
      .leftJoin(ingresoAplicaciones, and(eq(ingresoAplicaciones.ingresoId, ingresos.id), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt)))
      .where(whereCondition)
      .groupBy(ingresos.id, clientes.id, casos.id, tipoParam.id, obligadoCliente.id, obligadoTercero.id)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(orderExpr, asc(ingresos.id));

    const [{ count }] = await db
      .select({ count: sql`count(distinct ${ingresos.id})`.mapWith(Number) })
      .from(ingresos)
      .leftJoin(clientes, eq(ingresos.clienteId, clientes.id))
      .leftJoin(casos, eq(ingresos.casoId, casos.id))
      .leftJoin(obligadoCliente, eq(ingresos.obligadoClienteId, obligadoCliente.id))
      .leftJoin(obligadoTercero, eq(ingresos.obligadoTerceroId, obligadoTercero.id))
      .where(whereCondition);

    return { data, count };
  }

  /**
   * Superset de ingresos candidatos para la CC de un deudor:
   * - con aplicación viva sobre honorarios/cuotas del deudor (o gastos del cliente),
   * - cuyo obligado propio sea el deudor,
   * - legacy: ambos obligados null y cliente_id = deudor (solo cliente).
   */
  static async findIngresosCandidatosParaDeudor(
    estudioId: number,
    deudor: { tipo: "cliente" | "tercero"; id: number },
    pagination: Pagination,
  ) {
    const deudorHon = honorarioDeudorSqlCondition(deudor);

    const appSobreHonorario = exists(
      db
        .select({ one: sql`1` })
        .from(ingresoAplicaciones)
        .innerJoin(honorarios, eq(ingresoAplicaciones.honorarioId, honorarios.id))
        .where(and(
          eq(ingresoAplicaciones.ingresoId, ingresos.id),
          eq(ingresoAplicaciones.activo, true),
          isNull(ingresoAplicaciones.deletedAt),
          eq(honorarios.estudioId, estudioId),
          isNull(honorarios.deletedAt),
          deudorHon,
        )),
    );

    const appSobreCuota = exists(
      db
        .select({ one: sql`1` })
        .from(ingresoAplicaciones)
        .innerJoin(planCuotas, eq(ingresoAplicaciones.cuotaId, planCuotas.id))
        .innerJoin(planesPago, eq(planCuotas.planId, planesPago.id))
        .innerJoin(honorarios, eq(planesPago.honorarioId, honorarios.id))
        .where(and(
          eq(ingresoAplicaciones.ingresoId, ingresos.id),
          eq(ingresoAplicaciones.activo, true),
          isNull(ingresoAplicaciones.deletedAt),
          eq(honorarios.estudioId, estudioId),
          isNull(honorarios.deletedAt),
          isNull(planesPago.deletedAt),
          deudorHon,
        )),
    );

    const obligadoPropio = deudor.tipo === "tercero"
      ? eq(ingresos.obligadoTerceroId, deudor.id)
      : eq(ingresos.obligadoClienteId, deudor.id);

    const candidatoParts = [appSobreHonorario, appSobreCuota, obligadoPropio];
    if (deudor.tipo === "cliente") {
      candidatoParts.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(ingresoAplicaciones)
            .innerJoin(gastos, eq(ingresoAplicaciones.gastoId, gastos.id))
            .where(and(
              eq(ingresoAplicaciones.ingresoId, ingresos.id),
              eq(ingresoAplicaciones.activo, true),
              isNull(ingresoAplicaciones.deletedAt),
              eq(gastos.estudioId, estudioId),
              isNull(gastos.deletedAt),
              eq(gastos.clienteId, deudor.id),
            )),
        ),
        and(
          isNull(ingresos.obligadoClienteId),
          isNull(ingresos.obligadoTerceroId),
          eq(ingresos.clienteId, deudor.id),
        )!,
      );
    }

    const whereCondition = and(
      eq(ingresos.estudioId, estudioId),
      eq(ingresos.activo, true),
      isNull(ingresos.deletedAt),
      or(...candidatoParts)!,
    );

    const data = await db
      .select(getTableColumns(ingresos))
      .from(ingresos)
      .where(whereCondition)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(desc(ingresos.fechaIngreso), asc(ingresos.id));

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
