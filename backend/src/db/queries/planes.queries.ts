import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../index.js";
import { casos, categorias, clientes, gastos, honorarios, ingresos, ingresoAplicaciones, parametros, planCuotas, planesPago, terceros } from "../schema.js";

type NewPlanPago = typeof planesPago.$inferInsert;
type NewPlanCuota = typeof planCuotas.$inferInsert;
type NewIngreso = typeof ingresos.$inferInsert;
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | DbTransaction;

export class PlanesQueries {
  static async findPlanes(
    estudioId: number,
    filters: { clienteId?: number; casoId?: number; honorarioIds?: number[] } = {},
  ) {
    if (filters.honorarioIds !== undefined && filters.honorarioIds.length === 0) {
      return [];
    }

    const conditions = [
      eq(planesPago.estudioId, estudioId),
      isNull(planesPago.deletedAt),
    ];
    if (filters.honorarioIds) conditions.push(inArray(planesPago.honorarioId, filters.honorarioIds));
    if (filters.clienteId) conditions.push(eq(planesPago.clienteId, filters.clienteId));
    if (filters.casoId) conditions.push(eq(planesPago.casoId, filters.casoId));

    const obligadoCliente = alias(clientes, "plan_obligado_cliente");
    const deudorNombreExpr = sql<string | null>`CASE
      WHEN ${honorarios.obligadoTerceroId} IS NOT NULL THEN
        COALESCE(
          ${terceros.razonSocial},
          NULLIF(CONCAT_WS(', ', ${terceros.apellido}, ${terceros.nombre}), ''),
          ${terceros.nombre}
        )
      WHEN ${honorarios.obligadoClienteId} IS NOT NULL THEN
        COALESCE(
          ${obligadoCliente.razonSocial},
          NULLIF(CONCAT_WS(', ', ${obligadoCliente.apellido}, ${obligadoCliente.nombre}), ''),
          ${obligadoCliente.nombre}
        )
      ELSE
        COALESCE(
          ${clientes.razonSocial},
          NULLIF(CONCAT_WS(', ', ${clientes.apellido}, ${clientes.nombre}), ''),
          ${clientes.nombre}
        )
    END`;
    const tipoDeudorExpr = sql<"cliente" | "tercero">`CASE
      WHEN ${honorarios.obligadoTerceroId} IS NOT NULL THEN 'tercero'
      ELSE 'cliente'
    END`;

    return await db
      .select({
        id: planesPago.id,
        estudioId: planesPago.estudioId,
        honorarioId: planesPago.honorarioId,
        clienteId: planesPago.clienteId,
        casoId: planesPago.casoId,
        descripcion: planesPago.descripcion,
        fechaInicio: planesPago.fechaInicio,
        periodicidadId: planesPago.periodicidadId,
        montoCuotaPesos: planesPago.montoCuotaPesos,
        montoCuotaJus: planesPago.montoCuotaJus,
        valorJusRef: planesPago.valorJusRef,
        politicaJusId: planesPago.politicaJusId,
        monedaId: planesPago.monedaId,
        regimenMora: planesPago.regimenMora,
        monedaCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planesPago.monedaId})`,
        tasaInteresMensual: planesPago.tasaInteresMensual,
        diaVencimiento: planesPago.diaVencimiento,
        activo: planesPago.activo,
        createdBy: planesPago.createdBy,
        createdAt: planesPago.createdAt,
        updatedAt: planesPago.updatedAt,
        updatedBy: planesPago.updatedBy,
        deletedAt: planesPago.deletedAt,
        deletedBy: planesPago.deletedBy,
        obligadoClienteId: honorarios.obligadoClienteId,
        obligadoTerceroId: honorarios.obligadoTerceroId,
        tipoDeudor: tipoDeudorExpr,
        deudorNombre: deudorNombreExpr,
        cliente: {
          id: clientes.id,
          nombre: clientes.nombre,
          apellido: clientes.apellido,
          razonSocial: clientes.razonSocial,
        },
        caso: {
          id: casos.id,
          nroExpte: casos.nroExpte,
          caratula: casos.caratula,
        },
        periodicidad: {
          id: parametros.id,
          codigo: parametros.codigo,
          nombre: parametros.nombre,
        },
      })
      .from(planesPago)
      // Política histórica: los planes muestran cliente/caso/obligado aunque estén soft-deleted.
      .leftJoin(clientes, eq(planesPago.clienteId, clientes.id))
      .leftJoin(casos, eq(planesPago.casoId, casos.id))
      .leftJoin(parametros, eq(planesPago.periodicidadId, parametros.id))
      .leftJoin(honorarios, and(
        eq(planesPago.honorarioId, honorarios.id),
        eq(honorarios.estudioId, planesPago.estudioId),
      ))
      .leftJoin(terceros, and(
        eq(honorarios.obligadoTerceroId, terceros.id),
        eq(terceros.estudioId, planesPago.estudioId),
      ))
      .leftJoin(obligadoCliente, and(
        eq(honorarios.obligadoClienteId, obligadoCliente.id),
        eq(obligadoCliente.estudioId, planesPago.estudioId),
      ))
      .where(and(...conditions))
      .orderBy(planesPago.fechaInicio);
  }

  static async findPlanesByCaso(casoId: number, estudioId: number) {
    return await db
      .select()
      .from(planesPago)
      .where(and(eq(planesPago.casoId, casoId), eq(planesPago.estudioId, estudioId), isNull(planesPago.deletedAt)));
  }

  static async findPlanesByCliente(clienteId: number, estudioId: number) {
    return await db
      .select()
      .from(planesPago)
      .where(and(eq(planesPago.clienteId, clienteId), eq(planesPago.estudioId, estudioId), isNull(planesPago.deletedAt)));
  }

  static async findPlanById(id: number, estudioId: number, tx: DbExecutor = db) {
    const [row] = await tx
      .select()
      .from(planesPago)
      .where(and(eq(planesPago.id, id), eq(planesPago.estudioId, estudioId), isNull(planesPago.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  static async insertPlanPago(tx: DbExecutor, data: NewPlanPago) {
    const [row] = await tx.insert(planesPago).values(data).returning();
    return row;
  }

  static async insertPlanCuotas(tx: DbExecutor, cuotas: NewPlanCuota[]) {
    if (cuotas.length === 0) return [];
    return await tx.insert(planCuotas).values(cuotas).returning();
  }

  static async findCuotasByPlan(planId: number, estudioId: number, tx: DbExecutor = db) {
    return await tx
      .select({
        id: planCuotas.id,
        planId: planCuotas.planId,
        numero: planCuotas.numero,
        vencimiento: planCuotas.vencimiento,
        montoPesos: planCuotas.montoPesos,
        montoJus: planCuotas.montoJus,
        valorJusRef: planesPago.valorJusRef,
        estadoId: planCuotas.estadoId,
        estadoCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planCuotas.estadoId})`,
        activo: planCuotas.activo,
        createdBy: planCuotas.createdBy,
        createdAt: planCuotas.createdAt,
        updatedAt: planCuotas.updatedAt,
        updatedBy: planCuotas.updatedBy,
        deletedAt: planCuotas.deletedAt,
        deletedBy: planCuotas.deletedBy,
        politicaJusId: planesPago.politicaJusId,
        monedaId: planesPago.monedaId,
        monedaCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planesPago.monedaId})`,
        politicaCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planesPago.politicaJusId})`,
        montoCobrado: sql`coalesce(sum(${ingresoAplicaciones.montoCapital}), 0)`.mapWith(Number),
      })
      .from(planCuotas)
      .innerJoin(planesPago, eq(planCuotas.planId, planesPago.id))
      .leftJoin(ingresoAplicaciones, and(eq(ingresoAplicaciones.cuotaId, planCuotas.id), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt)))
      .where(and(eq(planCuotas.planId, planId), eq(planesPago.estudioId, estudioId), isNull(planesPago.deletedAt), isNull(planCuotas.deletedAt)))
      .groupBy(
        planCuotas.id,
        planCuotas.planId,
        planCuotas.numero,
        planCuotas.vencimiento,
        planCuotas.montoPesos,
        planCuotas.montoJus,
        planesPago.valorJusRef,
        planCuotas.estadoId,
        planCuotas.activo,
        planCuotas.createdBy,
        planCuotas.createdAt,
        planCuotas.updatedAt,
        planCuotas.updatedBy,
        planCuotas.deletedAt,
        planCuotas.deletedBy,
        planesPago.politicaJusId,
        planesPago.monedaId,
        planesPago.regimenMora
      )
      .orderBy(planCuotas.numero);
  }

  /** Batch de findCuotasByPlan para evitar N+1 en cuenta corriente. */
  static async findCuotasByPlanIds(planIds: number[], estudioId: number, tx: DbExecutor = db) {
    if (planIds.length === 0) return [];
    return await tx
      .select({
        id: planCuotas.id,
        planId: planCuotas.planId,
        numero: planCuotas.numero,
        vencimiento: planCuotas.vencimiento,
        montoPesos: planCuotas.montoPesos,
        montoJus: planCuotas.montoJus,
        valorJusRef: planesPago.valorJusRef,
        estadoId: planCuotas.estadoId,
        estadoCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planCuotas.estadoId})`,
        activo: planCuotas.activo,
        createdBy: planCuotas.createdBy,
        createdAt: planCuotas.createdAt,
        updatedAt: planCuotas.updatedAt,
        updatedBy: planCuotas.updatedBy,
        deletedAt: planCuotas.deletedAt,
        deletedBy: planCuotas.deletedBy,
        politicaJusId: planesPago.politicaJusId,
        monedaId: planesPago.monedaId,
        monedaCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planesPago.monedaId})`,
        politicaCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planesPago.politicaJusId})`,
        montoCobrado: sql`coalesce(sum(${ingresoAplicaciones.montoCapital}), 0)`.mapWith(Number),
      })
      .from(planCuotas)
      .innerJoin(planesPago, eq(planCuotas.planId, planesPago.id))
      .leftJoin(ingresoAplicaciones, and(eq(ingresoAplicaciones.cuotaId, planCuotas.id), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt)))
      .where(and(inArray(planCuotas.planId, planIds), eq(planesPago.estudioId, estudioId), isNull(planesPago.deletedAt), isNull(planCuotas.deletedAt)))
      .groupBy(
        planCuotas.id,
        planCuotas.planId,
        planCuotas.numero,
        planCuotas.vencimiento,
        planCuotas.montoPesos,
        planCuotas.montoJus,
        planesPago.valorJusRef,
        planCuotas.estadoId,
        planCuotas.activo,
        planCuotas.createdBy,
        planCuotas.createdAt,
        planCuotas.updatedAt,
        planCuotas.updatedBy,
        planCuotas.deletedAt,
        planCuotas.deletedBy,
        planesPago.politicaJusId,
        planesPago.monedaId,
        planesPago.regimenMora
      )
      .orderBy(planCuotas.planId, planCuotas.numero);
  }

  static async findCuotaById(id: number, estudioId: number, tx: DbExecutor = db) {
    const [row] = await tx
      .select({
        id: planCuotas.id,
        planId: planCuotas.planId,
        numero: planCuotas.numero,
        vencimiento: planCuotas.vencimiento,
        montoPesos: planCuotas.montoPesos,
        montoJus: planCuotas.montoJus,
        valorJusRef: planesPago.valorJusRef,
        estadoId: planCuotas.estadoId,
        estadoCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planCuotas.estadoId})`,
        estudioId: planesPago.estudioId,
        politicaJusId: planesPago.politicaJusId,
        politicaCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planesPago.politicaJusId})`,
        tasaInteresMensual: planesPago.tasaInteresMensual,
        regimenMora: planesPago.regimenMora,
        monedaId: planesPago.monedaId,
        monedaCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planesPago.monedaId})`,
      })
      .from(planCuotas)
      .innerJoin(planesPago, eq(planCuotas.planId, planesPago.id))
      .where(and(eq(planCuotas.id, id), eq(planesPago.estudioId, estudioId), isNull(planesPago.deletedAt), isNull(planCuotas.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  /**
   * Acquires a pessimistic lock (SELECT ... FOR UPDATE) on plan_cuotas rows.
   * MUST be called inside a transaction. Locks are always acquired in ascending
   * cuota ID order to prevent deadlocks when multiple cuotas are involved.
   */
  static async lockCuotasForUpdate(cuotaIds: number[], estudioId: number, tx: DbTransaction) {
    if (cuotaIds.length === 0) return [];
    const sortedIds = [...cuotaIds].sort((a, b) => a - b);
    return await tx
      .select({
        id: planCuotas.id,
        planId: planCuotas.planId,
        numero: planCuotas.numero,
        vencimiento: planCuotas.vencimiento,
        montoPesos: planCuotas.montoPesos,
        montoJus: planCuotas.montoJus,
        valorJusRef: planesPago.valorJusRef,
        estadoId: planCuotas.estadoId,
        regimenMora: planesPago.regimenMora,
        politicaCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planesPago.politicaJusId})`,
        monedaCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planesPago.monedaId})`,
      })
      .from(planCuotas)
      .innerJoin(planesPago, eq(planCuotas.planId, planesPago.id))
      .where(
        and(
          inArray(planCuotas.id, sortedIds),
          eq(planesPago.estudioId, estudioId),
          isNull(planCuotas.deletedAt),
          isNull(planesPago.deletedAt)
        )
      )
      .orderBy(asc(planCuotas.id))
      .for("update");
  }

  /**
   * Lock pesimista (SELECT ... FOR UPDATE) sobre gastos.
   * IDs en orden ASC para evitar deadlocks.
   */
  static async lockGastosForUpdate(gastoIds: number[], estudioId: number, tx: DbTransaction) {
    if (gastoIds.length === 0) return [];
    const sortedIds = [...gastoIds].sort((a, b) => a - b);
    return await tx
      .select({ id: gastos.id, monto: gastos.monto, fechaGasto: gastos.fechaGasto })
      .from(gastos)
      .where(
        and(
          inArray(gastos.id, sortedIds),
          eq(gastos.estudioId, estudioId),
          eq(gastos.activo, true),
          isNull(gastos.deletedAt),
        ),
      )
      .orderBy(asc(gastos.id))
      .for("update");
  }

  /**
   * Lock pesimista (SELECT ... FOR UPDATE) sobre honorarios de cobro directo.
   * IDs en orden ASC para evitar deadlocks.
   */
  static async lockHonorariosForUpdate(honorarioIds: number[], estudioId: number, tx: DbTransaction) {
    if (honorarioIds.length === 0) return [];
    const sortedIds = [...honorarioIds].sort((a, b) => a - b);
    return await tx
      .select({
        id: honorarios.id,
        jus: honorarios.jus,
        montoPesos: honorarios.montoPesos,
        valorJusRef: honorarios.valorJusRef,
      })
      .from(honorarios)
      .where(
        and(
          inArray(honorarios.id, sortedIds),
          eq(honorarios.estudioId, estudioId),
          isNull(honorarios.deletedAt),
        ),
      )
      .orderBy(asc(honorarios.id))
      .for("update");
  }

  /**
   * Sincroniza el espejo materializado plan_cuotas.monto_aplicado recalculando
   * SUM(ingreso_aplicaciones.monto_capital activas) directamente en la base (sin drift de
   * floats en JS). Idempotente: puede llamarse N veces con el mismo resultado.
   * Debe invocarse dentro de la transaccion que muta las aplicaciones, despues de
   * haber tomado el lock FOR UPDATE sobre la cuota. La fuente de verdad sigue siendo
   * la suma de aplicaciones; esta columna es solo guardrail.
   */
  static async syncMontoAplicadoCuota(cuotaId: number, tx: DbExecutor = db) {
    await tx
      .update(planCuotas)
      .set({
        montoAplicado: sql`coalesce((
          select sum(${ingresoAplicaciones.montoCapital})
          from ${ingresoAplicaciones}
          inner join ${ingresos} on ${ingresos.id} = ${ingresoAplicaciones.ingresoId}
          where ${ingresoAplicaciones.cuotaId} = ${planCuotas.id}
            and ${ingresoAplicaciones.activo} = true
            and ${ingresoAplicaciones.deletedAt} is null
            and ${ingresos.deletedAt} is null
        ), 0)`,
      })
      .where(eq(planCuotas.id, cuotaId));
  }

  /** Variante masiva de syncMontoAplicadoCuota para todas las cuotas de uno o varios planes. */
  static async syncMontoAplicadoByPlanes(planIds: number[], tx: DbExecutor = db) {
    if (planIds.length === 0) return;
    await tx
      .update(planCuotas)
      .set({
        montoAplicado: sql`coalesce((
          select sum(${ingresoAplicaciones.montoCapital})
          from ${ingresoAplicaciones}
          inner join ${ingresos} on ${ingresos.id} = ${ingresoAplicaciones.ingresoId}
          where ${ingresoAplicaciones.cuotaId} = ${planCuotas.id}
            and ${ingresoAplicaciones.activo} = true
            and ${ingresoAplicaciones.deletedAt} is null
            and ${ingresos.deletedAt} is null
        ), 0)`,
      })
      .where(inArray(planCuotas.planId, planIds));
  }

  static async sumAplicacionesByCuota(cuotaId: number, tx: DbExecutor = db) {
    const [row] = await tx
      .select({ total: sql`coalesce(sum(${ingresoAplicaciones.montoCapital}), 0)`.mapWith(Number) })
      .from(ingresoAplicaciones)
      .where(and(eq(ingresoAplicaciones.cuotaId, cuotaId), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt)));

    return row?.total ?? 0;
  }

  static async updatePlanPago(id: number, estudioId: number, data: Partial<NewPlanPago>) {
    const [row] = await db
      .update(planesPago)
      .set(data)
      .where(and(eq(planesPago.id, id), eq(planesPago.estudioId, estudioId), isNull(planesPago.deletedAt)))
      .returning();

    return row ?? null;
  }

  static async updatePlanPagoByHonorarioId(honorarioId: number, estudioId: number, data: Partial<NewPlanPago>) {
    const [row] = await db
      .update(planesPago)
      .set(data)
      .where(and(eq(planesPago.honorarioId, honorarioId), eq(planesPago.estudioId, estudioId), isNull(planesPago.deletedAt)))
      .returning();

    return row ?? null;
  }

  static async updatePlanCuota(id: number, estudioId: number, data: Partial<NewPlanCuota>, tx: DbExecutor = db) {
    const [row] = await tx
      .update(planCuotas)
      .set(data)
      .where(
        and(
          eq(planCuotas.id, id),
          sql`exists (
            select 1 from ${planesPago}
            where ${planesPago.id} = ${planCuotas.planId}
              and ${planesPago.estudioId} = ${estudioId}
              and ${planesPago.deletedAt} is null
          )`,
          isNull(planCuotas.deletedAt)
        )
      )
      .returning();

    return row ?? null;
  }

  static async deletePlanPago(id: number, estudioId: number, userId: number) {
    const now = new Date();
    return await db.transaction(async (tx) => {
      const [plan] = await tx
        .update(planesPago)
        .set({ activo: false, deletedAt: now, deletedBy: userId })
        .where(and(eq(planesPago.id, id), eq(planesPago.estudioId, estudioId), isNull(planesPago.deletedAt)))
        .returning();

      if (!plan) return null;

      await tx
        .update(planCuotas)
        .set({ activo: false, deletedAt: now, deletedBy: userId })
        .where(and(eq(planCuotas.planId, id), isNull(planCuotas.deletedAt)));

      await tx
        .update(ingresoAplicaciones)
        .set({ activo: false, deletedAt: now, deletedBy: userId })
        .where(sql`${ingresoAplicaciones.cuotaId} in (select ${planCuotas.id} from ${planCuotas} where ${planCuotas.planId} = ${id})`);

      await tx
        .update(ingresos)
        .set({ cuotaId: null })
        .where(sql`${ingresos.cuotaId} in (select ${planCuotas.id} from ${planCuotas} where ${planCuotas.planId} = ${id})`);

      // Espejo materializado: tras desactivar aplicaciones, monto_aplicado de estas
      // cuotas debe volver a reflejar la suma real (0 si no quedan activas).
      await this.syncMontoAplicadoByPlanes([id], tx);

      return plan;
    });
  }

  static async deletePlanesByHonorarioId(honorarioId: number, estudioId: number, userId: number) {
    const now = new Date();
    return await db.transaction(async (tx) => {
      const plans = await tx
        .select({ id: planesPago.id })
        .from(planesPago)
        .where(and(eq(planesPago.honorarioId, honorarioId), eq(planesPago.estudioId, estudioId), isNull(planesPago.deletedAt)));

      const planIds = plans.map((plan) => plan.id);
      if (planIds.length === 0) return [];
      const planIdsSql = sql.join(planIds.map((id) => sql`${id}`), sql`, `);

      await tx
        .update(planesPago)
        .set({ activo: false, deletedAt: now, deletedBy: userId })
        .where(and(inArray(planesPago.id, planIds), eq(planesPago.estudioId, estudioId), isNull(planesPago.deletedAt)));

      await tx
        .update(ingresoAplicaciones)
        .set({ activo: false, deletedAt: now, deletedBy: userId })
        .where(sql`${ingresoAplicaciones.cuotaId} in (select ${planCuotas.id} from ${planCuotas} where ${planCuotas.planId} in (${planIdsSql}))`);

      await tx
        .update(ingresos)
        .set({ cuotaId: null })
        .where(sql`${ingresos.cuotaId} in (select ${planCuotas.id} from ${planCuotas} where ${planCuotas.planId} in (${planIdsSql}))`);

      await tx
        .update(planCuotas)
        .set({ activo: false, deletedAt: now, deletedBy: userId })
        .where(and(inArray(planCuotas.planId, planIds), isNull(planCuotas.deletedAt)));

      // Espejo materializado: refleja la suma real tras desactivar aplicaciones.
      await this.syncMontoAplicadoByPlanes(planIds, tx);

      return plans;
    });
  }

  static async insertIngreso(tx: DbExecutor, data: NewIngreso) {
    const [row] = await tx.insert(ingresos).values(data).returning();
    return row;
  }

  static async insertIngresoAplicacion(tx: DbExecutor, data: typeof ingresoAplicaciones.$inferInsert) {
    const [row] = await tx.insert(ingresoAplicaciones).values(data).returning();
    return row;
  }

  static async findAplicacionesByIngresoActivas(ingresoId: number, tx: DbExecutor = db) {
    return await tx
      .select({
        id: ingresoAplicaciones.id,
        cuotaId: ingresoAplicaciones.cuotaId,
        gastoId: ingresoAplicaciones.gastoId,
        honorarioId: ingresoAplicaciones.honorarioId,
        monto: ingresoAplicaciones.monto,
        montoCapital: ingresoAplicaciones.montoCapital,
        montoInteres: ingresoAplicaciones.montoInteres,
      })
      .from(ingresoAplicaciones)
      .where(and(eq(ingresoAplicaciones.ingresoId, ingresoId), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt)));
  }

  static async findAplicacionesByHonorarioActivas(honorarioId: number, tx: DbExecutor = db) {
    return await tx
      .select({
        id: ingresoAplicaciones.id,
        monto: ingresoAplicaciones.monto,
        montoCapital: ingresoAplicaciones.montoCapital,
        montoInteres: ingresoAplicaciones.montoInteres,
        fechaIngreso: ingresos.fechaIngreso,
        valorJusAlCobro: ingresoAplicaciones.valorJusAlCobro,
      })
      .from(ingresoAplicaciones)
      .innerJoin(ingresos, eq(ingresoAplicaciones.ingresoId, ingresos.id))
      .where(and(eq(ingresoAplicaciones.honorarioId, honorarioId), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt), isNull(ingresos.deletedAt)))
      .orderBy(asc(ingresos.fechaIngreso), asc(ingresos.id));
  }

  /** Batch de aplicaciones directas a honorarios (sin plan). */
  static async findAplicacionesByHonorarioIds(honorarioIds: number[], tx: DbExecutor = db) {
    if (honorarioIds.length === 0) return [];
    return await tx
      .select({
        honorarioId: ingresoAplicaciones.honorarioId,
        id: ingresoAplicaciones.id,
        monto: ingresoAplicaciones.monto,
        montoCapital: ingresoAplicaciones.montoCapital,
        montoInteres: ingresoAplicaciones.montoInteres,
        fechaIngreso: ingresos.fechaIngreso,
        valorJusAlCobro: ingresoAplicaciones.valorJusAlCobro,
      })
      .from(ingresoAplicaciones)
      .innerJoin(ingresos, eq(ingresoAplicaciones.ingresoId, ingresos.id))
      .where(and(inArray(ingresoAplicaciones.honorarioId, honorarioIds), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt), isNull(ingresos.deletedAt)))
      .orderBy(asc(ingresoAplicaciones.honorarioId), asc(ingresos.fechaIngreso), asc(ingresos.id));
  }

  static async sumAplicacionesByHonorario(honorarioId: number, tx: DbExecutor = db) {
    const [row] = await tx
      .select({ total: sql`coalesce(sum(${ingresoAplicaciones.montoCapital}), 0)`.mapWith(Number) })
      .from(ingresoAplicaciones)
      .innerJoin(ingresos, eq(ingresoAplicaciones.ingresoId, ingresos.id))
      .where(and(eq(ingresoAplicaciones.honorarioId, honorarioId), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt), isNull(ingresos.deletedAt)));

    return row?.total ?? 0;
  }

  static async updateHonorarioEstado(honorarioId: number, estudioId: number, estadoId: number, tx: DbExecutor = db) {
    const [row] = await tx
      .update(honorarios)
      .set({ estadoId, updatedAt: new Date() })
      .where(and(eq(honorarios.id, honorarioId), eq(honorarios.estudioId, estudioId), isNull(honorarios.deletedAt)))
      .returning({ id: honorarios.id });

    return row ?? null;
  }

  /** Devuelve el plan de pago activo de un honorario, o null si cobra de forma directa (sin plan). */
  static async findPlanActivoByHonorarioId(honorarioId: number, estudioId: number, tx: DbExecutor = db) {
    const [row] = await tx
      .select({ id: planesPago.id })
      .from(planesPago)
      .where(and(
        eq(planesPago.honorarioId, honorarioId),
        eq(planesPago.estudioId, estudioId),
        eq(planesPago.activo, true),
        isNull(planesPago.deletedAt),
      ))
      .limit(1);

    return row ?? null;
  }

  /** Honorarios sin plan activo con saldo pendiente, filtrados por deudor-cliente. */
  static async findHonorariosSinPlanCobrables(estudioId: number, clienteId: number, casoId?: number) {
    const cobradoParam = await this.findParametroByCodigo("ESTADO_HONORARIO", "COBRADO");
    const anuladoParam = await this.findParametroByCodigo("ESTADO_HONORARIO", "ANULADO");
    const incobrableParam = await this.findParametroByCodigo("ESTADO_HONORARIO", "INCOBRABLE");
    const excluidos = [cobradoParam?.id, anuladoParam?.id, incobrableParam?.id]
      .filter((id): id is number => id != null);

    const rows = await db
      .select({
        id: honorarios.id,
        vencimiento: sql<Date>`coalesce(${honorarios.fechaVencimiento}, ${honorarios.fechaRegulacion})`,
      })
      .from(honorarios)
      .where(and(
        eq(honorarios.estudioId, estudioId),
        // Deudor = este cliente (tercero obligado queda fuera del FIFO del cliente).
        isNull(honorarios.obligadoTerceroId),
        sql`coalesce(${honorarios.obligadoClienteId}, ${honorarios.clienteId}) = ${clienteId}`,
        casoId ? eq(honorarios.casoId, casoId) : undefined,
        eq(honorarios.activo, true),
        isNull(honorarios.deletedAt),
        excluidos.length > 0 ? sql`(${honorarios.estadoId} is null or ${honorarios.estadoId} not in (${sql.join(excluidos, sql`, `)}))` : undefined,
        sql`not exists (
          select 1 from ${planesPago}
          where ${planesPago.honorarioId} = ${honorarios.id}
            and ${planesPago.activo} = true
            and ${planesPago.deletedAt} is null
        )`,
      ));

    return rows;
  }

  /**
   * Honorarios sin plan cuyo deudor es un tercero concreto (para FIFO acotado al deudor).
   */
  static async findHonorariosSinPlanCobrablesPorTercero(estudioId: number, terceroId: number, casoId?: number) {
    const cobradoParam = await this.findParametroByCodigo("ESTADO_HONORARIO", "COBRADO");
    const anuladoParam = await this.findParametroByCodigo("ESTADO_HONORARIO", "ANULADO");
    const incobrableParam = await this.findParametroByCodigo("ESTADO_HONORARIO", "INCOBRABLE");
    const excluidos = [cobradoParam?.id, anuladoParam?.id, incobrableParam?.id]
      .filter((id): id is number => id != null);

    return await db
      .select({
        id: honorarios.id,
        vencimiento: sql<Date>`coalesce(${honorarios.fechaVencimiento}, ${honorarios.fechaRegulacion})`,
      })
      .from(honorarios)
      .where(and(
        eq(honorarios.estudioId, estudioId),
        eq(honorarios.obligadoTerceroId, terceroId),
        casoId ? eq(honorarios.casoId, casoId) : undefined,
        eq(honorarios.activo, true),
        isNull(honorarios.deletedAt),
        excluidos.length > 0 ? sql`(${honorarios.estadoId} is null or ${honorarios.estadoId} not in (${sql.join(excluidos, sql`, `)}))` : undefined,
        sql`not exists (
          select 1 from ${planesPago}
          where ${planesPago.honorarioId} = ${honorarios.id}
            and ${planesPago.activo} = true
            and ${planesPago.deletedAt} is null
        )`,
      ));
  }

  static async findAplicacionesByGastoActivas(gastoId: number, tx: DbExecutor = db) {
    return await tx
      .select({
        id: ingresoAplicaciones.id,
        monto: ingresoAplicaciones.monto,
        montoCapital: ingresoAplicaciones.montoCapital,
        montoInteres: ingresoAplicaciones.montoInteres,
        fechaIngreso: ingresos.fechaIngreso,
      })
      .from(ingresoAplicaciones)
      .innerJoin(ingresos, eq(ingresoAplicaciones.ingresoId, ingresos.id))
      .where(and(eq(ingresoAplicaciones.gastoId, gastoId), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt), isNull(ingresos.deletedAt)))
      .orderBy(asc(ingresos.fechaIngreso), asc(ingresos.id));
  }

  static async sumAplicacionesByGasto(gastoId: number, tx: DbExecutor = db) {
    const [row] = await tx
      .select({ total: sql`coalesce(sum(${ingresoAplicaciones.montoCapital}), 0)`.mapWith(Number) })
      .from(ingresoAplicaciones)
      .innerJoin(ingresos, eq(ingresoAplicaciones.ingresoId, ingresos.id))
      .where(and(eq(ingresoAplicaciones.gastoId, gastoId), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt), isNull(ingresos.deletedAt)));

    return row?.total ?? 0;
  }

  static async deleteAplicacionesByIngreso(ingresoId: number, userId: number, tx: DbExecutor = db) {
    const now = new Date();
    return await tx
      .update(ingresoAplicaciones)
      .set({ activo: false, deletedAt: now, deletedBy: userId })
      .where(and(eq(ingresoAplicaciones.ingresoId, ingresoId), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt)))
      .returning();
  }

  static async findAplicacionesByCuotaActivas(cuotaId: number, tx: DbExecutor = db) {
    return await tx
      .select({
        id: ingresoAplicaciones.id,
        monto: ingresoAplicaciones.monto,
        montoCapital: ingresoAplicaciones.montoCapital,
        montoInteres: ingresoAplicaciones.montoInteres,
        fechaIngreso: ingresos.fechaIngreso,
        valorJusAlCobro: ingresoAplicaciones.valorJusAlCobro,
      })
      .from(ingresoAplicaciones)
      .innerJoin(ingresos, eq(ingresoAplicaciones.ingresoId, ingresos.id))
      .where(and(eq(ingresoAplicaciones.cuotaId, cuotaId), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt), isNull(ingresos.deletedAt)))
      .orderBy(asc(ingresos.fechaIngreso), asc(ingresos.id));
  }

  static async findAplicacionesByPlanCuotas(planId: number, tx: DbExecutor = db) {
    return await tx
      .select({
        cuotaId: ingresoAplicaciones.cuotaId,
        id: ingresoAplicaciones.id,
        ingresoId: ingresoAplicaciones.ingresoId,
        monto: ingresoAplicaciones.monto,
        montoCapital: ingresoAplicaciones.montoCapital,
        montoInteres: ingresoAplicaciones.montoInteres,
        fechaIngreso: ingresos.fechaIngreso,
        valorJusAlCobro: ingresoAplicaciones.valorJusAlCobro,
      })
      .from(ingresoAplicaciones)
      .innerJoin(ingresos, eq(ingresoAplicaciones.ingresoId, ingresos.id))
      .innerJoin(planCuotas, eq(ingresoAplicaciones.cuotaId, planCuotas.id))
      .where(and(eq(planCuotas.planId, planId), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt), isNull(ingresos.deletedAt), isNull(planCuotas.deletedAt)))
      .orderBy(asc(ingresoAplicaciones.cuotaId), asc(ingresos.fechaIngreso), asc(ingresoAplicaciones.id));
  }

  /** Batch de aplicaciones por varios planes (cuenta corriente). */
  static async findAplicacionesByPlanIds(planIds: number[], tx: DbExecutor = db) {
    if (planIds.length === 0) return [];
    return await tx
      .select({
        planId: planCuotas.planId,
        cuotaId: ingresoAplicaciones.cuotaId,
        id: ingresoAplicaciones.id,
        ingresoId: ingresoAplicaciones.ingresoId,
        monto: ingresoAplicaciones.monto,
        montoCapital: ingresoAplicaciones.montoCapital,
        montoInteres: ingresoAplicaciones.montoInteres,
        fechaIngreso: ingresos.fechaIngreso,
        valorJusAlCobro: ingresoAplicaciones.valorJusAlCobro,
      })
      .from(ingresoAplicaciones)
      .innerJoin(ingresos, eq(ingresoAplicaciones.ingresoId, ingresos.id))
      .innerJoin(planCuotas, eq(ingresoAplicaciones.cuotaId, planCuotas.id))
      .where(and(inArray(planCuotas.planId, planIds), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt), isNull(ingresos.deletedAt), isNull(planCuotas.deletedAt)))
      .orderBy(asc(planCuotas.planId), asc(ingresoAplicaciones.cuotaId), asc(ingresos.fechaIngreso), asc(ingresoAplicaciones.id));
  }

  static async findCuotasPendientesByPlan(planId: number, estudioId: number) {
    return await db
      .select({
        id: planCuotas.id,
        planId: planCuotas.planId,
        numero: planCuotas.numero,
        vencimiento: planCuotas.vencimiento,
        montoPesos: planCuotas.montoPesos,
        montoJus: planCuotas.montoJus,
        valorJusRef: planCuotas.valorJusRef,
        estadoId: planCuotas.estadoId,
        politicaCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planesPago.politicaJusId})`,
        monedaId: planesPago.monedaId,
        regimenMora: planesPago.regimenMora,
        monedaCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planesPago.monedaId})`,
        estadoCodigo: sql<string | null>`(select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planCuotas.estadoId})`,
        montoCobrado: sql`coalesce(sum(${ingresoAplicaciones.montoCapital}), 0)`.mapWith(Number),
      })
      .from(planCuotas)
      .innerJoin(planesPago, eq(planCuotas.planId, planesPago.id))
      .leftJoin(ingresoAplicaciones, and(eq(ingresoAplicaciones.cuotaId, planCuotas.id), eq(ingresoAplicaciones.activo, true), isNull(ingresoAplicaciones.deletedAt)))
      .where(and(eq(planCuotas.planId, planId), eq(planesPago.estudioId, estudioId), isNull(planesPago.deletedAt), isNull(planCuotas.deletedAt)))
      .groupBy(planCuotas.id, planesPago.politicaJusId, planesPago.monedaId, planesPago.regimenMora)
      .having(sql`coalesce((select ${parametros.codigo} from ${parametros} where ${parametros.id} = ${planCuotas.estadoId}), '') not in ('PAGADA', 'CONDONADA')`)
      .orderBy(asc(planCuotas.numero));
  }

  static async getCodigoEstadoCuota(estadoId: number | null) {
    if (!estadoId) return null;
    const row = await this.findParametroById(estadoId);
    return row?.codigo ?? null;
  }

  static async findParametroByCodigo(categoriaCodigo: string, parametroCodigo: string) {
    const [row] = await db
      .select({ id: parametros.id, codigo: parametros.codigo, nombre: parametros.nombre })
      .from(parametros)
      .innerJoin(categorias, eq(parametros.categoriaId, categorias.id))
      .where(and(eq(categorias.codigo, categoriaCodigo), eq(parametros.codigo, parametroCodigo), eq(parametros.activo, true)))
      .limit(1);

    return row ?? null;
  }

  static async findParametroById(id: number) {
    const [row] = await db
      .select({ id: parametros.id, codigo: parametros.codigo, nombre: parametros.nombre, categoriaCodigo: categorias.codigo })
      .from(parametros)
      .innerJoin(categorias, eq(parametros.categoriaId, categorias.id))
      .where(and(eq(parametros.id, id), eq(parametros.activo, true)))
      .limit(1);

    return row ?? null;
  }
}
