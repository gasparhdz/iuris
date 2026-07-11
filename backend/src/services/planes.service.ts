import { db } from "../db/index.js";
import { CasosQueries } from "../db/queries/casos.queries.js";
import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { GastosQueries } from "../db/queries/gastos.queries.js";
import { HonorariosQueries } from "../db/queries/honorarios.queries.js";
import { PlanesQueries } from "../db/queries/planes.queries.js";
import { serializeDates } from "../utils/serialize.js";
import { Decimal, jus, pesos } from "../utils/decimal.js";
import { ValorJusService } from "./valorjus.service.js";
import { calcularMora, moraAplica, normalizeRegimenMora } from "./mora.js";
import { imputarIngreso, ordenarPrelacion, type DeudaImputable } from "./imputacion.js";
import { assertMonedaSoportada } from "./moneda.validator.js";
import type { CreateIngresoInput, CreatePlanPagoInput, PlanPagoQuery } from "../schemas/planes.schema.js";
import { planCuotas, planesPago, gastos, honorarios } from "../db/schema.js";
import { and, eq, ne, isNull, sql } from "drizzle-orm";
import { assertMismoDeudor } from "./honorario-deudor.js";
import { endOfDayArgentina, startOfDayArgentina } from "../utils/timezone.js";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PlanCuotaDetalle = NonNullable<Awaited<ReturnType<typeof PlanesQueries.findCuotaById>>>;
type GastoDetalle = NonNullable<Awaited<ReturnType<typeof GastosQueries.findGastoById>>>;

/**
 * El plan hereda la política JUS del honorario subyacente.
 * - AL_COBRO: cuotas en JUS; valorJusRef null (cada cobro usa valorJusAlCobro).
 * - Cotización fija: cuotas con el valorJusRef del honorario (nunca el del día de creación).
 */
export function heredarPoliticaJusDelHonorario(input: {
  honorarioPoliticaCodigo: string | null;
  honorarioPoliticaJusId: number | null;
  honorarioValorJusRef: string | number | null;
  dataPoliticaJusId?: number | null;
  dataValorJusRef?: number | null;
  montoCuotaJus?: number | null;
}): { politicaJusId: number | null; valorJusRef: number | null } {
  const politicaJusId = input.honorarioPoliticaJusId ?? input.dataPoliticaJusId ?? null;
  if (input.montoCuotaJus == null) {
    return {
      politicaJusId,
      valorJusRef: input.dataValorJusRef ?? null,
    };
  }
  if (input.honorarioPoliticaCodigo === "AL_COBRO") {
    return { politicaJusId, valorJusRef: null };
  }
  const ref = input.honorarioValorJusRef != null
    ? Number(input.honorarioValorJusRef)
    : (input.dataValorJusRef ?? null);
  return { politicaJusId, valorJusRef: ref };
}

export class PlanesService {
  static async findPlanes(estudioId: number, filters: PlanPagoQuery = {}) {
    const planes = await PlanesQueries.findPlanes(estudioId, filters);
    const valorJusActual = await ValorJusService.getValorJusSnapshot(new Date(), estudioId);

    return await Promise.all(planes.map(async (plan) => {
      const politica = plan.politicaJusId ? await PlanesQueries.findParametroById(plan.politicaJusId) : null;
      const cuotas = await PlanesQueries.findCuotasByPlan(plan.id, estudioId);
      const todasLasAplicaciones = await PlanesQueries.findAplicacionesByPlanCuotas(plan.id);
      const aplicacionesByCuotaId = groupAplicacionesByCuota(todasLasAplicaciones);
      const cuotasNorm = cuotas.map((cuota) => {
        return normalizeCuota(cuota, {
          valorJusActual,
          tasaInteresMensual: plan.tasaInteresMensual !== null ? Number(plan.tasaInteresMensual) : null,
          regimenMora: plan.regimenMora,
          politicaCodigo: politica?.codigo ?? null,
          aplicacionesByCuota: aplicacionesByCuotaId.get(cuota.id) ?? [],
        });
      });
      const totalCobradoArs = cuotasNorm.reduce((acc, cuota: any) => acc + Number(cuota.montoCobrado ?? 0), 0);
      const totalSaldoArs = cuotasNorm.reduce((acc, cuota: any) => acc + Number(cuota.saldoPesos ?? 0), 0);

      return normalizePlan({
        ...plan,
        cliente: plan.cliente?.id ? plan.cliente : null,
        caso: plan.caso?.id ? plan.caso : null,
        periodicidad: plan.periodicidad?.id ? plan.periodicidad : null,
        obligadoClienteId: plan.obligadoClienteId ?? null,
        obligadoTerceroId: plan.obligadoTerceroId ?? null,
        tipoDeudor: plan.tipoDeudor ?? "cliente",
        deudorNombre: plan.deudorNombre ?? null,
        totalCobradoArs,
        totalSaldoArs,
        totalHonorarioArs: totalCobradoArs + totalSaldoArs,
      });
    }));
  }

  static async createPlan(estudioId: number, userId: number, data: CreatePlanPagoInput) {
    const honorario = await HonorariosQueries.findHonorarioById(data.honorarioId, estudioId);
    if (!honorario) throw new Error("HONORARIO_NOT_FOUND");

    // Un plan hereda el deudor del honorario (cliente u obligado tercero).
    assertMismoDeudor([{
      clienteId: honorario.clienteId,
      obligadoClienteId: honorario.obligadoClienteId ?? null,
      obligadoTerceroId: honorario.obligadoTerceroId ?? null,
    }]);

    await this.ensureRelatedEntities(estudioId, data.clienteId ?? undefined, data.casoId ?? undefined);

    const periodicidad = await PlanesQueries.findParametroById(data.periodicidadId);
    if (!periodicidad || periodicidad.categoriaCodigo !== "PERIODICIDAD") throw new Error("PERIODICIDAD_NOT_FOUND");

    const estadoPendienteId = await this.getEstadoCuotaId("PENDIENTE");
    if (estadoPendienteId === null) throw new Error("PARAMETRO_PENDIENTE_NOT_FOUND");

    const fechaInicio = new Date(data.fechaInicio);
    const politicaHonorario = honorario.politicaJusId
      ? await PlanesQueries.findParametroById(honorario.politicaJusId)
      : null;
    const inherited = heredarPoliticaJusDelHonorario({
      honorarioPoliticaCodigo: politicaHonorario?.codigo ?? null,
      honorarioPoliticaJusId: honorario.politicaJusId ?? null,
      honorarioValorJusRef: honorario.valorJusRef,
      dataPoliticaJusId: data.politicaJusId,
      dataValorJusRef: data.valorJusRef,
      montoCuotaJus: data.montoCuotaJus,
    });
    const valorJusRef = inherited.valorJusRef;
    if (data.montoCuotaJus && politicaHonorario?.codigo !== "AL_COBRO" && valorJusRef === null) {
      throw new Error("VALOR_JUS_NOT_FOUND");
    }

    const montoCuotaPesos = data.montoCuotaPesos ?? (
      data.montoCuotaJus && valorJusRef
        ? data.montoCuotaJus * valorJusRef
        : null
    );
    const tasaInteresMensual = data.tasaInteresMensual !== undefined
      ? data.tasaInteresMensual
      : (honorario.tasaInteresMensual !== null ? Number(honorario.tasaInteresMensual) / 100 : null);

    return await db.transaction(async (tx) => {
      const plan = await PlanesQueries.insertPlanPago(tx, {
        estudioId,
        honorarioId: data.honorarioId,
        clienteId: data.clienteId ?? (honorario.clienteId ?? null),
        casoId: data.casoId ?? (honorario.casoId ?? null),
        descripcion: data.descripcion ?? null,
        fechaInicio,
        periodicidadId: data.periodicidadId,
        montoCuotaPesos: montoCuotaPesos !== null ? montoCuotaPesos.toFixed(2) : null,
        montoCuotaJus: data.montoCuotaJus !== undefined && data.montoCuotaJus !== null ? data.montoCuotaJus.toFixed(4) : null,
        valorJusRef: valorJusRef !== null ? valorJusRef.toFixed(4) : null,
        politicaJusId: inherited.politicaJusId,
        monedaId: data.montoCuotaJus ? null : (honorario.monedaId ?? null),
        tasaInteresMensual: tasaInteresMensual !== null ? tasaInteresMensual.toFixed(6) : null,
        regimenMora: data.regimenMora ?? "SIMPLE",
        diaVencimiento: data.diaVencimiento ?? null,
        createdBy: userId,
      });

      const totalJus = honorario.jus !== null ? Number(honorario.jus) : null;
      const totalPesos = honorario.montoPesos !== null ? Number(honorario.montoPesos) : null;
      const isJus = data.montoCuotaJus !== undefined && data.montoCuotaJus !== null;
      const isPesos = data.montoCuotaPesos !== undefined && data.montoCuotaPesos !== null;

      const cuotasToInsert = Array.from({ length: data.cantidadCuotas }, (_, index) => {
        const isLast = index === data.cantidadCuotas - 1;
        let cuotaMontoJus: number | null = null;
        let cuotaMontoPesos: number | null = null;

        if (isJus && totalJus !== null) {
          if (isLast) {
            const sumPrevious = Number(data.montoCuotaJus) * (data.cantidadCuotas - 1);
            cuotaMontoJus = Number((totalJus - sumPrevious).toFixed(4));
          } else {
            cuotaMontoJus = Number(data.montoCuotaJus);
          }
          cuotaMontoPesos = valorJusRef ? cuotaMontoJus * valorJusRef : null;
        } else if (isPesos) {
          const targetTotalPesos = totalPesos ?? (totalJus && valorJusRef ? totalJus * valorJusRef : 0);
          if (isLast && targetTotalPesos > 0) {
            const sumPrevious = Number(data.montoCuotaPesos) * (data.cantidadCuotas - 1);
            cuotaMontoPesos = Number((targetTotalPesos - sumPrevious).toFixed(2));
          } else {
            cuotaMontoPesos = Number(data.montoCuotaPesos);
          }
        }

        return {
          planId: plan.id,
          numero: index + 1,
          vencimiento: computeVencimiento(fechaInicio, periodicidad.codigo, index, data.diasPeriodicidad, data.diaVencimiento),
          montoPesos: cuotaMontoPesos !== null ? cuotaMontoPesos.toFixed(2) : null,
          montoJus: cuotaMontoJus !== null ? cuotaMontoJus.toFixed(4) : null,
          valorJusRef: valorJusRef !== null ? valorJusRef.toFixed(4) : null,
          estadoId: estadoPendienteId,
          createdBy: userId,
        };
      });

      const cuotas = await PlanesQueries.insertPlanCuotas(tx, cuotasToInsert);

      const deudor = assertMismoDeudor([{
        clienteId: honorario.clienteId,
        obligadoClienteId: honorario.obligadoClienteId ?? null,
        obligadoTerceroId: honorario.obligadoTerceroId ?? null,
      }]);

      return {
        plan: normalizePlan({
          ...plan,
          obligadoClienteId: honorario.obligadoClienteId ?? null,
          obligadoTerceroId: honorario.obligadoTerceroId ?? null,
          tipoDeudor: deudor.tipo,
          deudorNombre: honorario.obligadoNombre ?? null,
        }),
        cuotas: cuotas.map((cuota) => normalizeCuota({ ...cuota, montoCobrado: 0 }, {
          tasaInteresMensual,
          regimenMora: data.regimenMora ?? "SIMPLE",
          politicaCodigo: inherited.politicaJusId ? (politicaHonorario?.codigo ?? undefined) : null,
          aplicacionesByCuota: [],
        })),
      };
    });
  }

  static async findCuotasByPlan(planId: number, estudioId: number) {
    const plan = await PlanesQueries.findPlanById(planId, estudioId);
    if (!plan) throw new Error("PLAN_NOT_FOUND");

    const politica = plan.politicaJusId ? await PlanesQueries.findParametroById(plan.politicaJusId) : null;
    const valorJusActual = politica?.codigo === "AL_COBRO"
      ? await ValorJusService.getValorJusSnapshot(new Date(), estudioId)
      : null;

    const cuotas = await PlanesQueries.findCuotasByPlan(planId, estudioId);
    const todasLasAplicaciones = await PlanesQueries.findAplicacionesByPlanCuotas(planId);
    const aplicacionesByCuotaId = groupAplicacionesByCuota(todasLasAplicaciones);
    return cuotas.map((cuota) => {
      return normalizeCuota(cuota, {
        valorJusActual,
        tasaInteresMensual: plan.tasaInteresMensual !== null ? Number(plan.tasaInteresMensual) : null,
        regimenMora: plan.regimenMora,
        politicaCodigo: politica?.codigo ?? null,
        aplicacionesByCuota: aplicacionesByCuotaId.get(cuota.id) ?? [],
      });
    });
  }

  static async findProyeccionCobranzas(estudioId: number) {
    const planes = await PlanesQueries.findPlanes(estudioId, {});
    const result: any[] = [];

    for (const plan of planes) {
      const cuotas = await this.findCuotasByPlan(plan.id, estudioId);
      for (const cuota of cuotas as any[]) {
        const estado = String(cuota.estadoCodigo ?? "").toUpperCase();
        const saldo = Number(cuota.saldoPesos ?? 0);
        if (["PAGADA", "CONDONADA"].includes(estado) || saldo <= 0.01) continue;
        result.push({
          planId: plan.id,
          cuotaId: cuota.id,
          numero: cuota.numero,
          vencimiento: cuota.vencimiento,
          saldoPesos: saldo,
          totalAPagarPesos: Number(cuota.totalAPagarPesos ?? saldo),
          estadoCodigo: estado,
          clienteId: plan.clienteId ?? null,
          cliente: plan.cliente?.id ? plan.cliente : null,
          casoId: plan.casoId ?? null,
          caso: plan.caso?.id ? plan.caso : null,
          tipoDeudor: plan.tipoDeudor ?? "cliente",
          deudorNombre: plan.deudorNombre ?? null,
          obligadoTerceroId: plan.obligadoTerceroId ?? null,
          obligadoClienteId: plan.obligadoClienteId ?? null,
        });
      }
    }

    return serializeDates(result);
  }

  static async registrarIngreso(estudioId: number, userId: number, data: CreateIngresoInput) {
    await assertMonedaSoportada(data.monedaId);
    await this.ensureRelatedEntities(estudioId, data.clienteId ?? undefined, data.casoId ?? undefined);
    let cuotaIds = [...(data.cuotaIds ?? [])];
    let gastoIds = [...(data.gastoIds ?? [])];
    let honorarioIds = [...(data.honorarioIds ?? [])];
    if (cuotaIds.length === 0 && data.cuotaId) cuotaIds = [data.cuotaId];

    if (cuotaIds.length === 0 && data.planId) {
      const cuotasPendientes = await PlanesQueries.findCuotasPendientesByPlan(data.planId, estudioId);
      if (cuotasPendientes.length > 0) cuotaIds = [cuotasPendientes[0].id];
    }

    if (cuotaIds.length === 0 && gastoIds.length === 0 && honorarioIds.length === 0) {
      if (!data.clienteId) {
        throw new Error("DEBES_SELECCIONAR_AL_MENOS_UNA_CUOTA_O_UN_GASTO");
      }

      // Query outstanding (unpaid) cuotas for the client
      const pagadaId = await PlanesService.getEstadoCuotaId("PAGADA");
      const condonadaParam = await PlanesQueries.findParametroByCodigo("ESTADO_CUOTA", "CONDONADA");
      const condonadaId = condonadaParam?.id ?? null;
      const queryCuotas = await db
        .select({
          id: planCuotas.id,
          vencimiento: planCuotas.vencimiento,
        })
        .from(planCuotas)
        .innerJoin(planesPago, eq(planCuotas.planId, planesPago.id))
        .innerJoin(honorarios, eq(planesPago.honorarioId, honorarios.id))
        .where(
          and(
            eq(planesPago.estudioId, estudioId),
            // FIFO del cliente: solo cuotas cuyo deudor es ese cliente (no cruza a terceros).
            isNull(honorarios.obligadoTerceroId),
            sql`coalesce(${honorarios.obligadoClienteId}, ${honorarios.clienteId}) = ${data.clienteId}`,
            data.casoId ? eq(planesPago.casoId, data.casoId) : undefined,
            eq(planCuotas.activo, true),
            eq(planesPago.activo, true),
            isNull(planCuotas.deletedAt),
            isNull(planesPago.deletedAt),
            isNull(honorarios.deletedAt),
            pagadaId ? ne(planCuotas.estadoId, pagadaId) : undefined,
            condonadaId ? ne(planCuotas.estadoId, condonadaId) : undefined
          )
        );

      // Query outstanding (unpaid) gastos for the client
      const gastoPagadoParam = await PlanesQueries.findParametroByCodigo("ESTADO_GASTO", "PAGADO");
      const gastoPagadoId = gastoPagadoParam?.id;
      const queryGastos = await db
        .select({
          id: gastos.id,
          vencimiento: gastos.fechaGasto,
        })
        .from(gastos)
        .where(
          and(
            eq(gastos.estudioId, estudioId),
            eq(gastos.clienteId, data.clienteId),
            data.casoId ? eq(gastos.casoId, data.casoId) : undefined,
            eq(gastos.activo, true),
            isNull(gastos.deletedAt),
            gastoPagadoId ? ne(gastos.estadoId, gastoPagadoId) : undefined
          )
        );

      // Honorarios que cobran de forma directa (sin plan) y siguen pendientes
      const queryHonorarios = await PlanesQueries.findHonorariosSinPlanCobrables(estudioId, data.clienteId, data.casoId ?? undefined);

      // Sort by date to apply FIFO
      queryCuotas.sort((a, b) => new Date(a.vencimiento).getTime() - new Date(b.vencimiento).getTime());
      queryGastos.sort((a, b) => new Date(a.vencimiento).getTime() - new Date(b.vencimiento).getTime());
      queryHonorarios.sort((a, b) => new Date(a.vencimiento).getTime() - new Date(b.vencimiento).getTime());

      // Map back to cuotaIds, gastoIds y honorarioIds
      cuotaIds = queryCuotas.map(c => c.id);
      gastoIds = queryGastos.map(g => g.id);
      honorarioIds = queryHonorarios.map(h => h.id);

      if (cuotaIds.length === 0 && gastoIds.length === 0 && honorarioIds.length === 0) {
        throw new Error("NO_HAY_DEUDAS_PENDIENTES_PARA_APLICAR_FIFO");
      }
    }

    const cuotasDetalle: PlanCuotaDetalle[] = [];
    for (const cuotaId of cuotaIds) {
      const cuota = await PlanesQueries.findCuotaById(cuotaId, estudioId);
      if (!cuota) throw new Error("CUOTA_NOT_FOUND");
      cuotasDetalle.push(cuota);
    }
    cuotasDetalle.sort((a, b) => a.numero - b.numero);

    const gastosDetalle: GastoDetalle[] = [];
    for (const gastoId of gastoIds) {
      const gasto = await GastosQueries.findGastoById(gastoId, estudioId);
      if (!gasto) throw new Error("GASTO_NOT_FOUND");
      gastosDetalle.push(gasto);
    }
    gastosDetalle.sort((a, b) => a.fechaGasto.getTime() - b.fechaGasto.getTime());

    const estadoGastoPagado = gastosDetalle.length > 0
      ? await PlanesQueries.findParametroByCodigo("ESTADO_GASTO", "PAGADO")
      : null;
    if (gastosDetalle.length > 0 && !estadoGastoPagado) throw new Error("PARAMETRO_PAGADO_NOT_FOUND");

    // Honorarios de cobro directo (sin plan). Un honorario con plan activo se cobra por sus cuotas.
    type HonorarioCobrable = NonNullable<Awaited<ReturnType<typeof HonorariosQueries.findHonorarioById>>> & { politicaCodigo: string | null };
    const honorariosDetalle: HonorarioCobrable[] = [];
    for (const honorarioId of honorarioIds) {
      const honorario = await HonorariosQueries.findHonorarioById(honorarioId, estudioId);
      if (!honorario) throw new Error("HONORARIO_NOT_FOUND");

      const planActivo = await PlanesQueries.findPlanActivoByHonorarioId(honorarioId, estudioId);
      if (planActivo) throw new Error("HONORARIO_CON_PLAN_NO_COBRABLE_DIRECTO");

      const estadoCodigo = honorario.estado?.codigo ?? null;
      if (estadoCodigo === "COBRADO" || estadoCodigo === "ANULADO" || estadoCodigo === "INCOBRABLE") {
        throw new Error("HONORARIO_NO_COBRABLE");
      }

      const politica = honorario.politicaJusId ? await PlanesQueries.findParametroById(honorario.politicaJusId) : null;
      honorariosDetalle.push({ ...honorario, politicaCodigo: politica?.codigo ?? null });
    }

    // Todas las deudas del ingreso (honorarios, cuotas y gastos) deben compartir el mismo deudor.
    // Los gastos se tratan como deuda del cliente del gasto.
    const honorariosParaDeudor: Array<{
      clienteId: number | null;
      obligadoClienteId: number | null;
      obligadoTerceroId: number | null;
    }> = [
      ...honorariosDetalle.map((h) => ({
        clienteId: h.clienteId,
        obligadoClienteId: h.obligadoClienteId ?? null,
        obligadoTerceroId: h.obligadoTerceroId ?? null,
      })),
    ];
    const planIdsUnicos = [...new Set(cuotasDetalle.map((c) => c.planId))];
    for (const planId of planIdsUnicos) {
      const plan = await PlanesQueries.findPlanById(planId, estudioId);
      if (!plan) throw new Error("PLAN_NOT_FOUND");
      const honorarioPlan = await HonorariosQueries.findHonorarioById(plan.honorarioId, estudioId);
      if (!honorarioPlan) throw new Error("HONORARIO_NOT_FOUND");
      honorariosParaDeudor.push({
        clienteId: honorarioPlan.clienteId,
        obligadoClienteId: honorarioPlan.obligadoClienteId ?? null,
        obligadoTerceroId: honorarioPlan.obligadoTerceroId ?? null,
      });
    }
    for (const gasto of gastosDetalle) {
      honorariosParaDeudor.push({
        clienteId: gasto.clienteId,
        obligadoClienteId: gasto.clienteId,
        obligadoTerceroId: null,
      });
    }
    if (honorariosParaDeudor.length > 0) {
      assertMismoDeudor(honorariosParaDeudor);
    }

    const fechaIngreso = new Date(data.fechaIngreso);
    const valorJusSnapshotCache = new Map<string, number>();
    const getJusSnapshot = async (fecha: Date) => {
      const fechaKey = fecha.toISOString().split("T")[0];
      if (valorJusSnapshotCache.has(fechaKey)) return valorJusSnapshotCache.get(fechaKey)!;
      const snapshot = await ValorJusService.getValorJusSnapshot(fecha, estudioId);
      if (snapshot === null) throw new Error("VALOR_JUS_NOT_FOUND");
      const value = Number(snapshot);
      valorJusSnapshotCache.set(fechaKey, value);
      return value;
    };

    const ingreso = await db.transaction(async (tx) => {
      const nuevo = await PlanesQueries.insertIngreso(tx, {
        estudioId,
        clienteId: data.clienteId ?? null,
        casoId: data.casoId ?? null,
        cuotaId: null,
        descripcion: data.descripcion ?? null,
        monto: data.monto.toFixed(2),
        monedaId: data.monedaId ?? null,
        cotizacionArs: data.cotizacionArs !== undefined && data.cotizacionArs !== null ? String(data.cotizacionArs) : null,
        valorJusAlCobro: null,
        fechaIngreso,
        tipoId: data.tipoId ?? null,
        estadoId: data.estadoId ?? null,
        createdBy: userId,
      });

      // Lock cuotas / gastos / honorarios con FOR UPDATE en orden ASC de ID (anti-deadlock)
      if (cuotasDetalle.length > 0) {
        const cuotaIdsOrdenados = cuotasDetalle.map(c => c.id).sort((a, b) => a - b);
        const cuotasBloqueadas = await PlanesQueries.lockCuotasForUpdate(cuotaIdsOrdenados, estudioId, tx);
        if (cuotasBloqueadas.length !== cuotaIdsOrdenados.length) {
          throw new Error("CUOTA_NOT_FOUND");
        }
      }
      if (gastosDetalle.length > 0) {
        const gastoIdsOrdenados = gastosDetalle.map(g => g.id).sort((a, b) => a - b);
        const gastosBloqueados = await PlanesQueries.lockGastosForUpdate(gastoIdsOrdenados, estudioId, tx);
        if (gastosBloqueados.length !== gastoIdsOrdenados.length) {
          throw new Error("GASTO_NOT_FOUND");
        }
      }
      if (honorariosDetalle.length > 0) {
        const honorarioIdsOrdenados = honorariosDetalle.map(h => h.id).sort((a, b) => a - b);
        const honorariosBloqueados = await PlanesQueries.lockHonorariosForUpdate(honorarioIdsOrdenados, estudioId, tx);
        if (honorariosBloqueados.length !== honorarioIdsOrdenados.length) {
          throw new Error("HONORARIO_NOT_FOUND");
        }
      }

      const deudas: DeudaImputable[] = [];
      const cuotaMeta = new Map<string, { cuota: PlanCuotaDetalle; valorJusAlCobro: string | null }>();
      const gastoMeta = new Map<string, { gasto: GastoDetalle; saldoPesos: Decimal }>();
      const honorarioMeta = new Map<string, { honorario: HonorarioCobrable; valorJusAlCobro: string | null }>();

      for (const gasto of gastosDetalle) {
        const totalAplicado = pesos(String(await PlanesQueries.sumAplicacionesByGasto(gasto.id, tx)));
        const saldoPesos = pesos(String(gasto.monto)).sub(totalAplicado).max(Decimal.zero(2));
        if (saldoPesos.isZeroOrLess()) continue;
        const deudaId = `gasto:${gasto.id}`;
        deudas.push({
          id: deudaId,
          tipo: "GASTO",
          vencimiento: gasto.fechaGasto,
          saldoPesos,
          interesPesos: Decimal.zero(2),
        });
        gastoMeta.set(deudaId, { gasto, saldoPesos });
      }

      for (const cuota of cuotasDetalle) {
        const aplicaciones = await PlanesQueries.findAplicacionesByCuotaActivas(cuota.id, tx);
        const saldo = await calcularSaldoCuota(cuota, aplicaciones, fechaIngreso, getJusSnapshot);
        if (saldo.saldoPesos.isZeroOrLess()) continue;

        const tasaMensual = cuota.tasaInteresMensual !== null ? Decimal.of(cuota.tasaInteresMensual, 6) : Decimal.zero(6);
        const vencida = cuota.vencimiento < fechaIngreso;
        const monedaCodigo = String(cuota.monedaCodigo ?? "").toUpperCase();
        const esUsd = monedaCodigo === "USD" || monedaCodigo === "DOLAR" || monedaCodigo === "DÓLAR" || monedaCodigo === "DÃ“LAR";
        const interes = moraAplica({
          politicaCodigo: cuota.politicaCodigo,
          esJus: saldo.esJus,
          esUsd,
          tieneMontoPesos: cuota.montoPesos !== null,
          tasaMensual,
          vencida,
          saldoPositivo: saldo.saldoPesos.isPositive(),
        })
          ? calcularMora({
              capital: saldo.capitalNativo,
              moneda: saldo.esJus ? "JUS" : "PESOS",
              vencimiento: cuota.vencimiento,
              fechaCorte: fechaIngreso,
              tasaMensual,
              regimen: normalizeRegimenMora(cuota.regimenMora),
              baseDias: 30,
              pagos: aplicaciones.map((app) => ({
                fecha: app.fechaIngreso,
                montoPesos: pesos(app.montoCapital),
                valorJusAlCobro: app.valorJusAlCobro !== null ? jus(app.valorJusAlCobro) : saldo.valorJusRef,
              })),
              valorJusAlCorte: saldo.valorJusAlCobro ?? saldo.valorJusRef,
            }).interesPesos
          : Decimal.zero(2);
        const deudaId = `cuota:${cuota.id}`;
        deudas.push({
          id: deudaId,
          tipo: "CUOTA",
          vencimiento: cuota.vencimiento,
          saldoPesos: saldo.saldoPesos,
          interesPesos: interes,
        });
        cuotaMeta.set(deudaId, { cuota, valorJusAlCobro: saldo.valorJusAlCobro?.toPg() ?? null });
      }

      for (const honorario of honorariosDetalle) {
        const aplicaciones = await PlanesQueries.findAplicacionesByHonorarioActivas(honorario.id, tx);
        const saldo = await calcularSaldoCuota(
          {
            montoJus: honorario.jus,
            montoPesos: honorario.montoPesos,
            valorJusRef: honorario.valorJusRef,
            politicaCodigo: honorario.politicaCodigo,
          },
          aplicaciones,
          fechaIngreso,
          getJusSnapshot,
        );
        if (saldo.saldoPesos.isZeroOrLess()) continue;

        const vencimiento = honorario.fechaVencimiento ?? honorario.fechaRegulacion;
        const tasaMensual = honorario.tasaInteresMensual !== null ? Decimal.of(honorario.tasaInteresMensual, 6) : Decimal.zero(6);
        const vencida = vencimiento < fechaIngreso;
        const monedaCodigo = String(honorario.moneda?.codigo ?? "").toUpperCase();
        const esUsd = monedaCodigo === "USD" || monedaCodigo === "DOLAR" || monedaCodigo === "DÓLAR" || monedaCodigo === "DÃ“LAR";
        const interes = moraAplica({
          politicaCodigo: honorario.politicaCodigo,
          esJus: saldo.esJus,
          esUsd,
          tieneMontoPesos: honorario.montoPesos !== null,
          tasaMensual,
          vencida,
          saldoPositivo: saldo.saldoPesos.isPositive(),
        })
          ? calcularMora({
              capital: saldo.capitalNativo,
              moneda: saldo.esJus ? "JUS" : "PESOS",
              vencimiento,
              fechaCorte: fechaIngreso,
              tasaMensual,
              regimen: normalizeRegimenMora(null),
              baseDias: 30,
              pagos: aplicaciones.map((app) => ({
                fecha: app.fechaIngreso,
                montoPesos: pesos(app.montoCapital),
                valorJusAlCobro: app.valorJusAlCobro !== null ? jus(app.valorJusAlCobro) : saldo.valorJusRef,
              })),
              valorJusAlCorte: saldo.valorJusAlCobro ?? saldo.valorJusRef,
            }).interesPesos
          : Decimal.zero(2);
        const deudaId = `honorario:${honorario.id}`;
        deudas.push({
          id: deudaId,
          tipo: "HONORARIO",
          vencimiento,
          saldoPesos: saldo.saldoPesos,
          interesPesos: interes,
        });
        honorarioMeta.set(deudaId, { honorario, valorJusAlCobro: saldo.valorJusAlCobro?.toPg() ?? null });
      }

      const { movimientos } = imputarIngreso(pesos(String(data.monto)), ordenarPrelacion(deudas, fechaIngreso));
      for (const movimiento of movimientos) {
        const cuota = cuotaMeta.get(movimiento.deudaId);
        if (cuota) {
          await PlanesQueries.insertIngresoAplicacion(tx, {
            estudioId,
            ingresoId: nuevo.id,
            cuotaId: cuota.cuota.id,
            monto: movimiento.total.toPg(),
            montoCapital: movimiento.aCapital.toPg(),
            montoInteres: movimiento.aInteres.toPg(),
            valorJusAlCobro: cuota.valorJusAlCobro,
            createdBy: userId,
          });
          await PlanesService.recomputeCuotaEstado(cuota.cuota.id, estudioId, tx);
          continue;
        }

        const gasto = gastoMeta.get(movimiento.deudaId);
        if (gasto) {
          await PlanesQueries.insertIngresoAplicacion(tx, {
            estudioId,
            ingresoId: nuevo.id,
            cuotaId: null,
            gastoId: gasto.gasto.id,
            monto: movimiento.total.toPg(),
            montoCapital: movimiento.aCapital.toPg(),
            montoInteres: movimiento.aInteres.toPg(),
            valorJusAlCobro: null,
            createdBy: userId,
          });

          if (movimiento.aCapital.gte(gasto.saldoPesos)) {
            await GastosQueries.updateGastoTx(gasto.gasto.id, estudioId, {
              estadoId: estadoGastoPagado!.id,
              updatedAt: new Date(),
              updatedBy: userId,
            }, tx);
          }
          continue;
        }

        const honorario = honorarioMeta.get(movimiento.deudaId);
        if (honorario) {
          await PlanesQueries.insertIngresoAplicacion(tx, {
            estudioId,
            ingresoId: nuevo.id,
            cuotaId: null,
            honorarioId: honorario.honorario.id,
            monto: movimiento.total.toPg(),
            montoCapital: movimiento.aCapital.toPg(),
            montoInteres: movimiento.aInteres.toPg(),
            valorJusAlCobro: honorario.valorJusAlCobro,
            createdBy: userId,
          });
          await PlanesService.recomputeHonorarioEstado(honorario.honorario.id, estudioId, tx);
        }
      }

      return nuevo;
    });

    return normalizeIngreso(ingreso);
  }

  static async deletePlan(id: number, estudioId: number, userId: number) {
    const deleted = await PlanesQueries.deletePlanPago(id, estudioId, userId);
    if (!deleted) throw new Error("PLAN_NOT_FOUND");
    // Tras desactivar aplicaciones de cuotas, el honorario vuelve a PENDIENTE/PARCIAL
    // según lo efectivamente cobrado restante (aplicaciones directas al honorario).
    await PlanesService.recomputeHonorarioEstado(deleted.honorarioId, estudioId);
  }

  static async recomputeCuotaEstado(cuotaId: number, estudioId: number, tx?: DbTransaction) {
    const cuota = await PlanesQueries.findCuotaById(cuotaId, estudioId, tx);
    if (!cuota) throw new Error("CUOTA_NOT_FOUND");

    // Sincroniza el espejo materializado monto_aplicado SIEMPRE, antes de cualquier
    // early-return, para que el guardrail refleje la realidad incluso en cuotas
    // CONDONADAS o sin monto definido. Es el chokepoint comun de todas las rutas que
    // mutan ingreso_aplicaciones (alta en loop, aplicarIngresoACuota, borrado/edicion
    // de ingreso).
    await PlanesQueries.syncMontoAplicadoCuota(cuotaId, tx);

    const estadoActualCodigo = await PlanesQueries.getCodigoEstadoCuota(cuota.estadoId);
    if (estadoActualCodigo === "CONDONADA") return;

    const aplicaciones = await PlanesQueries.findAplicacionesByCuotaActivas(cuotaId, tx);
    const saldo = await calcularSaldoCuota(cuota, aplicaciones, new Date(), async () => {
      const snapshot = await ValorJusService.getValorJusSnapshot(new Date(), estudioId);
      if (snapshot === null) throw new Error("VALOR_JUS_NOT_FOUND");
      return Number(snapshot);
    });
    if (!saldo.tieneCapital) {
      return;
    }

    const hoyInicio = startOfDayArgentina(new Date());
    const vencida = endOfDayArgentina(cuota.vencimiento) < hoyInicio;
    let nuevoEstadoCodigo: "PENDIENTE" | "PARCIAL" | "VENCIDA" | "PAGADA";
    if (saldo.capitalNativo.isZeroOrLess()) {
      nuevoEstadoCodigo = "PAGADA";
    } else if (aplicaciones.length > 0) {
      nuevoEstadoCodigo = vencida ? "VENCIDA" : "PARCIAL";
    } else {
      nuevoEstadoCodigo = vencida ? "VENCIDA" : "PENDIENTE";
    }

    const estadoId = await PlanesService.getEstadoCuotaId(nuevoEstadoCodigo);
    if (!estadoId) return;
    await PlanesQueries.updatePlanCuota(cuotaId, estudioId, { estadoId, updatedAt: new Date() }, tx);
  }

  static async recomputeHonorarioEstado(honorarioId: number, estudioId: number, tx?: DbTransaction) {
    const honorario = await HonorariosQueries.findHonorarioById(honorarioId, estudioId);
    if (!honorario) throw new Error("HONORARIO_NOT_FOUND");

    const estadoCodigo = honorario.estado?.codigo ?? null;
    // No tocamos honorarios fuera del ciclo de cobro directo (anulados/incobrables).
    if (estadoCodigo === "ANULADO" || estadoCodigo === "INCOBRABLE") return;

    const politica = honorario.politicaJusId ? await PlanesQueries.findParametroById(honorario.politicaJusId) : null;
    const aplicaciones = await PlanesQueries.findAplicacionesByHonorarioActivas(honorarioId, tx ?? db);
    const saldo = await calcularSaldoCuota(
      {
        montoJus: honorario.jus,
        montoPesos: honorario.montoPesos,
        valorJusRef: honorario.valorJusRef,
        politicaCodigo: politica?.codigo ?? null,
      },
      aplicaciones,
      new Date(),
      async () => {
        const snapshot = await ValorJusService.getValorJusSnapshot(new Date(), estudioId);
        if (snapshot === null) throw new Error("VALOR_JUS_NOT_FOUND");
        return Number(snapshot);
      },
    );

    let nuevoEstadoCodigo: "PENDIENTE" | "PARCIAL" | "COBRADO";
    if (saldo.capitalNativo.isZeroOrLess()) {
      nuevoEstadoCodigo = "COBRADO";
    } else if (aplicaciones.length > 0) {
      nuevoEstadoCodigo = "PARCIAL";
    } else {
      nuevoEstadoCodigo = "PENDIENTE";
    }

    const estado = await HonorariosQueries.findParametroByCodigo("ESTADO_HONORARIO", nuevoEstadoCodigo);
    if (!estado) return;
    await PlanesQueries.updateHonorarioEstado(honorarioId, estudioId, estado.id, tx ?? db);
  }

  private static async ensureRelatedEntities(estudioId: number, clienteId?: number, casoId?: number) {
    if (clienteId) {
      const cliente = await ClientesQueries.findById(clienteId, estudioId);
      if (!cliente) throw new Error("CLIENTE_NOT_FOUND");
    }

    if (casoId) {
      const caso = await CasosQueries.findById(casoId, estudioId);
      if (!caso) throw new Error("CASO_NOT_FOUND");
    }
  }

  private static async getEstadoCuotaId(codigo: "PENDIENTE" | "PAGADA" | "PARCIAL" | "VENCIDA") {
    const estado = await PlanesQueries.findParametroByCodigo("ESTADO_CUOTA", codigo);
    return estado?.id ?? null;
  }
}

function computeVencimiento(
  fechaInicio: Date,
  periodicidadCodigo: string,
  index: number,
  diasPeriodicidad?: number,
  diaVencimiento?: number | null
): Date {
  if (periodicidadCodigo === "MENSUAL") {
    const d = new Date(fechaInicio);
    const targetMonth = d.getMonth() + index;
    const year = d.getFullYear() + Math.floor(targetMonth / 12);
    const month = ((targetMonth % 12) + 12) % 12;
    const dia = diaVencimiento ?? d.getDate();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dia, lastDay));
  }
  const fecha = new Date(fechaInicio);
  const dias = periodicidadCodigo === "SEMANAL" ? 7
    : periodicidadCodigo === "QUINCENAL" ? 15
    : (diasPeriodicidad ?? 30);
  fecha.setDate(fecha.getDate() + dias * index);
  return fecha;
}

function normalizePlan<T extends {
  montoCuotaPesos: string | number | null;
  montoCuotaJus: string | number | null;
  valorJusRef: string | number | null;
  monedaId?: number | null;
  tasaInteresMensual?: string | number | null;
  totalCobradoArs?: number;
  totalSaldoArs?: number;
  totalHonorarioArs?: number;
}>(plan: T) {
  const montoCuotaPesos = plan.montoCuotaPesos !== null ? Number(plan.montoCuotaPesos) : null;
  const montoCuotaJus = plan.montoCuotaJus !== null ? Number(plan.montoCuotaJus) : null;
  const valorJusRef = plan.valorJusRef !== null ? Number(plan.valorJusRef) : null;

  return serializeDates({
    ...plan,
    montoCuotaPesos,
    montoCuotaJus,
    valorJusRef,
    tasaInteresMensual: plan.tasaInteresMensual !== undefined && plan.tasaInteresMensual !== null ? Number(plan.tasaInteresMensual) : null,
  });
}

function groupAplicacionesByCuota<T extends { cuotaId: number | null }>(aplicaciones: T[]) {
  const map = new Map<number, T[]>();
  for (const aplicacion of aplicaciones) {
    if (!aplicacion.cuotaId) continue;
    const list = map.get(aplicacion.cuotaId) ?? [];
    list.push(aplicacion);
    map.set(aplicacion.cuotaId, list);
  }
  return map;
}

type AplicacionCuotaCalculo = {
  monto: string;
  montoCapital: string;
  montoInteres?: string;
  fechaIngreso: Date;
  valorJusAlCobro: string | null;
};

export async function calcularSaldoCuota(
  cuota: {
    montoJus: string | null;
    montoPesos: string | null;
    valorJusRef: string | null;
    politicaCodigo: string | null;
  },
  aplicaciones: AplicacionCuotaCalculo[],
  fechaValuacion: Date,
  getJusSnapshot: (fecha: Date) => Promise<number>,
): Promise<{
  tieneCapital: boolean;
  esJus: boolean;
  capitalNativo: Decimal;
  saldoPesos: Decimal;
  valorJusRef: Decimal | null;
  valorJusAlCobro: Decimal | null;
}> {
  const valorJusRef = cuota.valorJusRef !== null ? jus(cuota.valorJusRef) : null;
  if (cuota.montoJus !== null && jus(cuota.montoJus).isPositive()) {
    const montoJus = jus(cuota.montoJus);
    const jusPagados = aplicaciones.reduce((acc, app) => {
      const divisor = cuota.politicaCodigo === "AL_COBRO"
        ? (app.valorJusAlCobro !== null ? jus(app.valorJusAlCobro) : (valorJusRef ?? jus(1)))
        : (valorJusRef ?? jus(1));
      return acc.add(pesos(app.montoCapital).divByRate(divisor, 4));
    }, Decimal.zero(4));
    const saldoJus = montoJus.sub(jusPagados).max(Decimal.zero(4));
    const valorJusAlCobro = cuota.politicaCodigo === "AL_COBRO" ? jus((await getJusSnapshot(fechaValuacion)).toString()) : null;
    const valorAplicado = valorJusAlCobro ?? valorJusRef ?? jus(0);
    return {
      tieneCapital: true,
      esJus: true,
      capitalNativo: saldoJus,
      saldoPesos: saldoJus.mulByRate(valorAplicado, 2),
      valorJusRef,
      valorJusAlCobro,
    };
  }

  if (cuota.montoPesos !== null) {
    const montoPesos = pesos(cuota.montoPesos);
    const totalCobrado = aplicaciones.reduce((acc, app) => acc.add(pesos(app.montoCapital)), Decimal.zero(2));
    const saldoPesos = montoPesos.sub(totalCobrado).max(Decimal.zero(2));
    return {
      tieneCapital: true,
      esJus: false,
      capitalNativo: saldoPesos,
      saldoPesos,
      valorJusRef,
      valorJusAlCobro: null,
    };
  }

  return {
    tieneCapital: false,
    esJus: false,
    capitalNativo: Decimal.zero(2),
    saldoPesos: Decimal.zero(2),
    valorJusRef,
    valorJusAlCobro: null,
  };
}

function normalizeCuota(cuota: any, opts: {
  valorJusActual?: number | null;
  tasaInteresMensual?: number | null;
  regimenMora?: string | null;
  politicaCodigo?: string | null;
  aplicacionesByCuota?: any[];
  fechaCorte?: Date;
}) {
  const { valorJusActual, tasaInteresMensual, regimenMora, politicaCodigo, aplicacionesByCuota = [], fechaCorte = new Date() } = opts;
  const montoJus = cuota.montoJus !== null ? Number(cuota.montoJus) : null;
  const montoPesos = cuota.montoPesos !== null ? Number(cuota.montoPesos) : null;
  const valorJusRef = cuota.valorJusRef !== null ? Number(cuota.valorJusRef) : null;
  const montoCobradoDecimal = aplicacionesByCuota.reduce((acc: Decimal, app: any) => acc.add(pesos(app.montoCapital ?? app.monto)), Decimal.zero(2));
  const montoCobrado = montoCobradoDecimal.toNumber();
  const isJus = montoJus !== null && montoJus > 0;
  const monedaCodigo = String(cuota.monedaCodigo ?? "").toUpperCase();
  const isUsd = monedaCodigo === "USD" || monedaCodigo === "DOLAR" || monedaCodigo === "DÓLAR";
  const isAlCobro = politicaCodigo === "AL_COBRO";
  const isFechaReg = politicaCodigo === "FECHA_REGULACION";
  const valorJusEfectivo = isAlCobro ? (valorJusActual ?? valorJusRef) : valorJusRef;

  let saldoJus: number | null = null;
  let cobradoJus: number | null = null;
  if (isJus && valorJusRef) {
    const jusPagadosDecimal = aplicacionesByCuota.reduce((acc: Decimal, app: any) => {
      const divisor = isAlCobro
        ? (app.valorJusAlCobro !== null ? jus(app.valorJusAlCobro) : jus(valorJusRef))
        : jus(valorJusRef);
      return acc.add(pesos(app.montoCapital ?? app.monto).divByRate(divisor, 4));
    }, Decimal.zero(4));
    const saldoJusDecimal = jus(montoJus).sub(jusPagadosDecimal).max(Decimal.zero(4));
    cobradoJus = jusPagadosDecimal.toNumber();
    saldoJus = saldoJusDecimal.toNumber();
  }

  let saldoPesos: number | null = null;
  let objetivoPesos: number | null = null;
  if (isJus && valorJusEfectivo !== null) {
    objetivoPesos = montoJus * valorJusEfectivo;
    saldoPesos = saldoJus !== null ? saldoJus * valorJusEfectivo : null;
  } else if (montoPesos !== null) {
    objetivoPesos = montoPesos;
    saldoPesos = pesos(String(montoPesos)).sub(montoCobradoDecimal).max(Decimal.zero(2)).toNumber();
  }
  if (saldoPesos !== null && saldoPesos <= 0.01) saldoPesos = 0;

  const hoy = fechaCorte;
  const vencimiento = cuota.vencimiento instanceof Date ? cuota.vencimiento : new Date(cuota.vencimiento);
  const vencida = vencimiento < hoy;
  const diasVencida = vencida ? Math.floor((hoy.getTime() - vencimiento.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const tasaMensualDecimal = tasaInteresMensual !== null && tasaInteresMensual !== undefined
    ? Decimal.of(String(tasaInteresMensual), 6)
    : Decimal.zero(6);
  const aplicaInteres = moraAplica({
    politicaCodigo,
    esJus: isJus,
    esUsd: isUsd,
    tieneMontoPesos: montoPesos !== null,
    tasaMensual: tasaMensualDecimal,
    vencida,
    saldoPositivo: (isJus ? jus(String(saldoJus ?? 0)) : pesos(String(saldoPesos ?? 0))).isPositive(),
  });

  let interesJus: number | null = null;
  let interesPesos: number | null = null;
  if (aplicaInteres && tasaInteresMensual) {
    const resultado = calcularMora({
      capital: isJus ? jus(String(montoJus)) : pesos(String(montoPesos)),
      moneda: isJus ? "JUS" : "PESOS",
      vencimiento,
      pagos: aplicacionesByCuota.map((app: any) => ({
        montoPesos: pesos(app.montoCapital ?? app.monto),
        fecha: app.fechaIngreso instanceof Date ? app.fechaIngreso : new Date(app.fechaIngreso),
        valorJusAlCobro: app.valorJusAlCobro !== null ? jus(app.valorJusAlCobro) : (valorJusRef !== null ? jus(valorJusRef) : null),
      })),
      fechaCorte: hoy,
      tasaMensual: tasaInteresMensual,
      regimen: normalizeRegimenMora(regimenMora),
      baseDias: 30,
      valorJusAlCorte: isJus ? jus(String(valorJusEfectivo ?? valorJusRef ?? 0)) : null,
    });
    if (isJus && valorJusRef) {
      interesJus = resultado.interesNativo.toNumber();
      interesPesos = resultado.interesPesos.toNumber();
    } else {
      interesPesos = resultado.interesPesos.toNumber();
    }
  }

  return serializeDates({
    ...cuota,
    montoJus,
    valorJusRef,
    valorJusHoy: isAlCobro ? (valorJusActual ?? null) : null,
    montoPesos: objetivoPesos,
    montoCobrado,
    cobradoJus,
    saldoJus,
    saldoPesos,
    saldo: saldoPesos,
    interes: {
      aplica: aplicaInteres,
      jus: interesJus,
      pesos: interesPesos,
      diasVencida,
    },
    totalAPagarPesos: saldoPesos !== null ? saldoPesos + (interesPesos ?? 0) : null,
  });
}

function normalizeIngreso<T extends {
  monto: string;
  cotizacionArs: string | null;
  valorJusAlCobro?: string | null;
}>(ingreso: T) {
  return serializeDates({
    ...ingreso,
    monto: Number(ingreso.monto),
    cotizacionArs: ingreso.cotizacionArs !== null ? Number(ingreso.cotizacionArs) : null,
    valorJusAlCobro: ingreso.valorJusAlCobro !== undefined && ingreso.valorJusAlCobro !== null ? Number(ingreso.valorJusAlCobro) : null,
  });
}

/**
 * Standalone function for applying an ingreso to a single cuota with pessimistic locking.
 * Creates its own transaction, acquires FOR UPDATE lock on the cuota,
 * validates that the monto doesn't exceed the pending balance, and rejects with
 * MONTO_EXCEDE_SALDO_CUOTA if it does.
 */
export async function aplicarIngresoACuota(
  dbInstance: typeof db,
  params: {
    ingresoId: number;
    cuotaId: number;
    estudioId: number;
    monto: number;
    userId: number;
  }
): Promise<{ montoAplicado: number }> {
  const tolerancia = pesos("0.01");

  return dbInstance.transaction(async (tx) => {
    // 1. Lock cuota row — acts as mutex
    const [cuotaBloqueada] = await PlanesQueries.lockCuotasForUpdate(
      [params.cuotaId], params.estudioId, tx
    );
    if (!cuotaBloqueada) throw new Error("CUOTA_NOT_FOUND");

    // 2. Recalculate sum(ingreso_aplicaciones.monto) INSIDE the lock
    const aplicaciones = await PlanesQueries.findAplicacionesByCuotaActivas(params.cuotaId, tx);

    const saldo = await calcularSaldoCuota(cuotaBloqueada, aplicaciones, new Date(), async (fecha) => {
      const jusActual = await ValorJusService.getValorJusSnapshot(fecha, params.estudioId);
      if (jusActual === null) throw new Error("VALOR_JUS_NOT_FOUND");
      return Number(jusActual);
    });
    const montoSolicitado = pesos(String(params.monto));

    // 3. Reject if monto exceeds pending balance
    if (montoSolicitado.gt(saldo.saldoPesos.add(tolerancia))) {
      throw new Error("MONTO_EXCEDE_SALDO_CUOTA");
    }

    const montoAImputar = montoSolicitado.min(saldo.saldoPesos);
    if (montoAImputar.isZeroOrLess()) {
      throw new Error("MONTO_EXCEDE_SALDO_CUOTA");
    }

    // 4. Insert aplicación + update estado in same transaction
    await PlanesQueries.insertIngresoAplicacion(tx, {
      estudioId: params.estudioId,
      ingresoId: params.ingresoId,
      cuotaId: params.cuotaId,
      monto: montoAImputar.toPg(),
      montoCapital: montoAImputar.toPg(),
      montoInteres: Decimal.zero(2).toPg(),
      valorJusAlCobro: saldo.valorJusAlCobro?.toPg() ?? null,
      createdBy: params.userId,
    });

    await PlanesService.recomputeCuotaEstado(params.cuotaId, params.estudioId, tx);

    return { montoAplicado: montoAImputar.toNumber() };
  });
}
