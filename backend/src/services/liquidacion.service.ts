import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { CasosQueries } from "../db/queries/casos.queries.js";
import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { GastosQueries } from "../db/queries/gastos.queries.js";
import { HonorariosQueries } from "../db/queries/honorarios.queries.js";
import { IngresosQueries } from "../db/queries/ingresos.queries.js";
import { db as appDb } from "../db/index.js";
import { casos, gastos, honorarios, ingresos } from "../db/schema.js";
import { serializeDates } from "../utils/serialize.js";
import { HonorariosService } from "./honorarios.service.js";
import { ValorJusService } from "./valorjus.service.js";

type MonedaOriginal = "ARS" | "USD" | "JUS";

type LiquidacionDetalle = {
  tipo: "HONORARIO" | "GASTO" | "INGRESO";
  id: number;
  fecha: string;
  fechaVencimiento?: string | null;
  clienteId: number | null;
  casoId: number | null;
  descripcion: string;
  montoPesos: number;
  monedaOriginal?: MonedaOriginal;
  cantidadOriginal?: number;
  cotizacionArs?: number | null;
    estado?: {
    id: number | null;
    codigo: string | null;
    nombre: string | null;
    } | null;
  jusAplicados?: number;
  montoAplicadoJusPesos?: number;
};

type DbExecutor = typeof appDb;

export type SaldoBidimensional = {
  jus: number;
  pesos: number;
  valorJusAplicado: number | null;
  esEstimado: boolean;
};

export type LineaLiquidacion = LiquidacionDetalle & {
  capital: SaldoBidimensional;
  interes: SaldoBidimensional;
  saldo: SaldoBidimensional;
};

export type ReporteLiquidacion = {
  detalles: LiquidacionDetalle[];
  lineas: LineaLiquidacion[];
  cotizacion: {
    valorJusActual: number;
    fechaCorte: string;
  };
  totales: {
    capitalJus: number;
    capitalPesos: number;
    interesPesos: number;
    saldoTotalPesos: number;
    saldoTotalJus: number;
  };
  leyenda: string;
};

export type LiquidacionConsolidada = {
  honorarios: string;
  gastos: string;
  ingresos: string;
  saldo: string;
};

export type LiquidacionCasoConsolidada = LiquidacionConsolidada & {
  casoId: number;
};

export async function liquidacionCaso(db: DbExecutor, casoId: number, estudioId: number): Promise<LiquidacionCasoConsolidada | null> {
  const honorariosTotal = totalHonorariosFor(sql`${casos.id}`);
  const gastosTotal = totalGastosFor(sql`${casos.id}`);
  const ingresosTotal = totalIngresosFor(sql`${casos.id}`);

  const [row] = await db
    .select({
      casoId: casos.id,
      honorarios: honorariosTotal,
      gastos: gastosTotal,
      ingresos: ingresosTotal,
      saldo: sql<string>`(${honorariosTotal} + ${gastosTotal} - ${ingresosTotal})::numeric(14,2)`,
    })
    .from(casos)
    .where(and(eq(casos.id, casoId), eq(casos.estudioId, estudioId), isNull(casos.deletedAt)))
    .limit(1);

  return row ?? null;
}

export async function liquidacionPorEstudio(db: DbExecutor, estudioId: number): Promise<LiquidacionCasoConsolidada[]> {
  const honorariosAgg = db
    .select({
      casoId: honorarios.casoId,
      total: sql<string>`coalesce(sum(${honorarios.montoPesos}), 0)::numeric(14,2)`.as("total_honorarios"),
    })
    .from(honorarios)
    .where(and(eq(honorarios.estudioId, estudioId), isNull(honorarios.deletedAt)))
    .groupBy(honorarios.casoId)
    .as("honorarios_agg");

  const gastosAgg = db
    .select({
      casoId: gastos.casoId,
      total: sql<string>`coalesce(sum(${gastos.monto} * coalesce(${gastos.cotizacionArs}, 1)), 0)::numeric(14,2)`.as("total_gastos"),
    })
    .from(gastos)
    .where(and(eq(gastos.estudioId, estudioId), isNull(gastos.deletedAt)))
    .groupBy(gastos.casoId)
    .as("gastos_agg");

  const ingresosAgg = db
    .select({
      casoId: ingresos.casoId,
      total: sql<string>`coalesce(sum(${ingresos.monto}), 0)::numeric(14,2)`.as("total_ingresos"),
    })
    .from(ingresos)
    .where(and(eq(ingresos.estudioId, estudioId), isNull(ingresos.deletedAt)))
    .groupBy(ingresos.casoId)
    .as("ingresos_agg");

  return await db
    .select({
      casoId: casos.id,
      honorarios: sql<string>`coalesce(${honorariosAgg.total}, 0)::numeric(14,2)`,
      gastos: sql<string>`coalesce(${gastosAgg.total}, 0)::numeric(14,2)`,
      ingresos: sql<string>`coalesce(${ingresosAgg.total}, 0)::numeric(14,2)`,
      saldo: sql<string>`(coalesce(${honorariosAgg.total}, 0) + coalesce(${gastosAgg.total}, 0) - coalesce(${ingresosAgg.total}, 0))::numeric(14,2)`,
    })
    .from(casos)
    .leftJoin(honorariosAgg, eq(honorariosAgg.casoId, casos.id))
    .leftJoin(gastosAgg, eq(gastosAgg.casoId, casos.id))
    .leftJoin(ingresosAgg, eq(ingresosAgg.casoId, casos.id))
    .where(and(eq(casos.estudioId, estudioId), isNull(casos.deletedAt)))
    .orderBy(casos.createdAt);
}

export class LiquidacionService {
  static liquidacionCaso(casoId: number, estudioId: number) {
    return liquidacionCaso(appDb, casoId, estudioId);
  }

  static liquidacionPorEstudio(estudioId: number) {
    return liquidacionPorEstudio(appDb, estudioId);
  }

  static async getLiquidacionCaso(casoId: number, estudioId: number) {
    const caso = await CasosQueries.findById(casoId, estudioId);
    if (!caso) throw new Error("CASO_NOT_FOUND");

    return await this.buildLiquidacion(estudioId, { casoId });
  }

  static async getLiquidacionCliente(clienteId: number, estudioId: number) {
    const cliente = await ClientesQueries.findById(clienteId, estudioId);
    if (!cliente) throw new Error("CLIENTE_NOT_FOUND");

    return await this.buildLiquidacion(estudioId, { clienteId });
  }

  private static async buildLiquidacion(estudioId: number, filters: { casoId?: number; clienteId?: number }) {
    const consolidada = filters.casoId ? await liquidacionCaso(appDb, filters.casoId, estudioId) : null;
    const [{ data: honorarios }, { data: gastos }, { data: ingresos }, valorJusActual, valoresJus] = await Promise.all([
      HonorariosQueries.findHonorarios(estudioId, filters, { limit: 10000, offset: 0 }),
      GastosQueries.findGastos(estudioId, filters, { limit: 10000, offset: 0 }),
      IngresosQueries.findIngresos(estudioId, filters, { limit: 10000, offset: 0 }),
      ValorJusService.getValorJusSnapshot(new Date(), estudioId),
      ValorJusService.findAll(estudioId, { page: 1, limit: 10000 }),
    ]);
    const valorJusActualNum = Number(valorJusActual ?? 0);

    const parametroCache = new Map<number, Awaited<ReturnType<typeof HonorariosQueries.findParametroById>>>();
    const getParametro = async (id: number | null | undefined) => {
      if (!id) return null;
      if (!parametroCache.has(id)) {
        parametroCache.set(id, await HonorariosQueries.findParametroById(id));
      }
      return parametroCache.get(id) ?? null;
    };
    const getCurrency = async (
      moneda: { codigo: string | null } | null | undefined,
      monedaId: number | null | undefined,
    ): Promise<MonedaOriginal> => {
      const codigo = (moneda?.codigo ?? (await getParametro(monedaId))?.codigo ?? "").toUpperCase();
      if (codigo.includes("JUS")) return "JUS";
      if (codigo.includes("USD") || codigo.includes("DOLAR") || codigo.includes("DÓLAR")) return "USD";
      return "ARS";
    };

    const detallesHonorarios = await Promise.all(honorarios.map(async (honorario): Promise<LiquidacionDetalle> => {
      const politica = honorario.politicaJusId ? await getParametro(honorario.politicaJusId) : null;
      const monedaOriginal = await getCurrency(honorario.moneda, honorario.monedaId);
      
      // Para la regulación inicial, siempre usamos el valor JUS histórico de la fecha de regulación
      const valorJusRef = honorario.valorJusRef !== null 
        ? Number(honorario.valorJusRef) 
        : Number(await ValorJusService.getValorJusSnapshot(honorario.fechaRegulacion, estudioId) ?? 0);

      const calc = HonorariosService.computeMontos({
        jus: honorario.jus !== null ? Number(honorario.jus) : null,
        montoPesos: honorario.montoPesos !== null ? Number(honorario.montoPesos) : null,
        valorJusRef,
        fechaVencimiento: honorario.fechaVencimiento,
        tasaInteresMensual: honorario.tasaInteresMensual !== null ? Number(honorario.tasaInteresMensual) : null,
        estadoCodigo: honorario.estado?.codigo ?? null,
      });

      return {
        tipo: "HONORARIO",
        id: honorario.id,
        fecha: honorario.fechaRegulacion.toISOString(),
        fechaVencimiento: honorario.fechaVencimiento?.toISOString() ?? null,
        clienteId: honorario.clienteId,
        casoId: honorario.casoId,
        descripcion: honorario.concepto?.nombre ?? "Honorario",
        montoPesos: calc.totalConInteres ?? calc.totalPesosRef ?? 0,
        monedaOriginal,
        cantidadOriginal: monedaOriginal === "JUS" ? Number(honorario.jus ?? 0) : Number(honorario.montoPesos ?? 0),
        cotizacionArs: monedaOriginal === "JUS" ? valorJusRef : null,
        estado: honorario.estado,
      };
    }));

    const detallesGastos = await Promise.all(gastos.map(async (gasto): Promise<LiquidacionDetalle> => {
      const monedaOriginal = await getCurrency(null, gasto.monedaId);
      const estadoParam = await getParametro(gasto.estadoId);
      const cantidadOriginal = Number(gasto.monto);
      const cotizacionHistorica = gasto.cotizacionArs !== null ? Number(gasto.cotizacionArs) : null;
      const pagado = (estadoParam?.codigo ?? "").toUpperCase() === "PAGADO";
      const cotizacionAplicada = monedaOriginal === "JUS"
        ? (pagado ? (cotizacionHistorica ?? valorJusActualNum) : valorJusActualNum)
        : cotizacionHistorica;

      return {
        tipo: "GASTO",
        id: gasto.id,
        fecha: gasto.fechaGasto.toISOString(),
        clienteId: gasto.clienteId,
        casoId: gasto.casoId,
        descripcion: gasto.descripcion ?? "Gasto",
        montoPesos: monedaOriginal === "JUS" ? cantidadOriginal * Number(cotizacionAplicada ?? 0) : cantidadOriginal,
        monedaOriginal,
        cantidadOriginal,
        cotizacionArs: cotizacionAplicada,
        estado: estadoParam ? { id: estadoParam.id, codigo: estadoParam.codigo, nombre: estadoParam.nombre } : null,
      };
    }));

    const detallesIngresos = await Promise.all(ingresos.map(async (ingreso): Promise<LiquidacionDetalle> => {
      const cotizacionHistorica = ingreso.cotizacionArs !== null ? Number(ingreso.cotizacionArs) : null;
      const montoPesos = Number(ingreso.monto);
      const monedaOriginal = cotizacionHistorica && cotizacionHistorica > 0
        ? "JUS"
        : await getCurrency(null, ingreso.monedaId);

      return {
        tipo: "INGRESO",
        id: ingreso.id,
        fecha: ingreso.fechaIngreso.toISOString(),
        clienteId: ingreso.clienteId,
        casoId: ingreso.casoId,
        descripcion: ingreso.descripcion ?? "Ingreso",
        montoPesos,
        monedaOriginal,
        cantidadOriginal: monedaOriginal === "JUS" && cotizacionHistorica ? montoPesos / cotizacionHistorica : montoPesos,
        cotizacionArs: cotizacionHistorica,
        jusAplicados: Number((ingreso as any).jusAplicados ?? 0),
        montoAplicadoJusPesos: Number((ingreso as any).montoAplicadoJusPesos ?? 0),
      };
    }));

    // 1. Preparar eventos para la simulación cronológica del backend
    const backendEvents: any[] = [];

    detallesHonorarios.forEach((item, index) => {
      const raw = honorarios[index];
      const appliesInterest = !!raw.tasaInteresMensual && Number(raw.tasaInteresMensual) > 0;
      const interestRate = appliesInterest ? Number(raw.tasaInteresMensual) : 0;
      
      backendEvents.push({
        id: `honorario-${item.id}`,
        type: "debe",
        tipoMov: "HONORARIO",
        date: new Date(item.fecha),
        currency: item.monedaOriginal,
        principal: item.cantidadOriginal,
        interestRate,
        source: item,
        descripcion: item.descripcion,
      });
    });

    detallesGastos.forEach((item) => {
      backendEvents.push({
        id: `gasto-${item.id}`,
        type: "debe",
        tipoMov: "GASTO",
        date: new Date(item.fecha),
        currency: item.monedaOriginal,
        principal: item.cantidadOriginal,
        interestRate: 0,
        source: item,
        descripcion: item.descripcion,
      });
    });

    detallesIngresos.forEach((item) => {
      const jusAplicados = Number(item.jusAplicados ?? 0);
      const montoAplicadoJusPesos = Number(item.montoAplicadoJusPesos ?? 0);
      if (jusAplicados > 0 && montoAplicadoJusPesos > 0) {
        backendEvents.push({
          id: `ingreso-${item.id}-jus`,
          type: "haber",
          tipoMov: "INGRESO",
          date: new Date(item.fecha),
          currency: "JUS",
          amount: jusAplicados,
          amountPesos: montoAplicadoJusPesos,
          source: { ...item, cotizacionArs: montoAplicadoJusPesos / jusAplicados },
          descripcion: item.descripcion,
        });
      }

      const montoTotalPesos = Number(item.montoPesos ?? 0);
      if (jusAplicados > 0 && montoTotalPesos - montoAplicadoJusPesos <= 0.01) return;
      const residualPesos = jusAplicados > 0 ? Math.max(0, montoTotalPesos - montoAplicadoJusPesos) : montoTotalPesos;
      if (residualPesos <= 0.01) return;
      backendEvents.push({
        id: `ingreso-${item.id}`,
        type: "haber",
        tipoMov: "INGRESO",
        date: new Date(item.fecha),
        currency: jusAplicados > 0 ? "ARS" : item.monedaOriginal,
        amount: jusAplicados > 0 ? residualPesos : item.cantidadOriginal,
        source: jusAplicados > 0 ? { ...item, montoPesos: residualPesos, cantidadOriginal: residualPesos, cotizacionArs: null } : item,
        descripcion: item.descripcion,
      });
    });

    valoresJus.data.items.forEach((item) => {
      if (!item) return;
      backendEvents.push({
        id: `valor-jus-${item.id}`,
        type: "valorJus",
        tipoMov: "VALOR_JUS",
        date: new Date(item.fecha),
        currency: "JUS",
        valor: Number(item.valor),
        source: item,
        descripcion: "Actualización JUS",
      });
    });

    // Ordenamos cronológicamente. Si caen el mismo día, van los Debes primero.
    backendEvents.sort((a, b) => {
      const tA = a.date.getTime();
      const tB = b.date.getTime();
      if (tA !== tB) return tA - tB;
      const priority: Record<string, number> = { valorJus: 0, debe: 1, haber: 2 };
      return (priority[a.type] ?? 9) - (priority[b.type] ?? 9);
    });

    interface ActiveDebt {
      id: string;
      tipo: string;
      currency: string;
      principal: number;
      interestRate: number;
      lastInterestCalcDate: Date;
      fechaRegulacion: Date;
      accumulatedInterest: number;
    }

    const activeDebts: ActiveDebt[] = [];
    const simulatedDetalles: any[] = [];

    let totalHonorariosPesos = 0;
    let totalGastosPesos = 0;
    let totalIngresosPesos = 0;

    const today = new Date();

    const getDaysBetween = (start: Date, end: Date) => {
      const sUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
      const eUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
      const diffTime = eUtc - sUtc;
      if (diffTime <= 0) return 0;
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    };

    let runningJus = 0;
    let runningSaldo = 0;
    let lastJusRate = 0;
    let virtualIdCounter = 0;

    backendEvents.forEach((event) => {
      const eventDate = event.date;

      // 1. Determinar cotización JUS de este evento
      let eventJusRate = 0;
      if (event.type === "valorJus") {
        eventJusRate = Number(event.valor || 0);
      } else if (event.currency === "JUS") {
        eventJusRate = Number(event.source.cotizacionArs || valorJusActualNum);
      }

      // 2. Ajuste JUS si cambió la cotización
      if (runningJus > 0 && lastJusRate > 0 && eventJusRate > 0 && eventJusRate !== lastJusRate) {
        const adjustment = runningJus * (eventJusRate - lastJusRate);
        if (Math.abs(adjustment) > 0.01) {
          runningSaldo += adjustment;
          virtualIdCounter--;
          simulatedDetalles.push({
            tipo: "AJUSTE",
            id: virtualIdCounter,
            fecha: eventDate.toISOString(),
            descripcion: `Ajuste por Actualización JUS (${runningJus.toFixed(2)} JUS adeudados)`,
            montoPesos: Math.abs(adjustment),
            debe: adjustment > 0 ? Math.abs(adjustment) : 0,
            haber: adjustment < 0 ? Math.abs(adjustment) : 0,
            monedaOriginal: "ARS",
            cantidadOriginal: 0,
            cotizacionArs: null,
            estado: null,
          });
        }
        lastJusRate = eventJusRate;
      } else if (lastJusRate === 0 && eventJusRate > 0) {
        lastJusRate = eventJusRate;
      }

      if (event.type === "valorJus") return;

      // 3. Calcular intereses acumulados
      activeDebts.forEach((debt) => {
        if (debt.principal > 0 && debt.interestRate > 0) {
          const days = getDaysBetween(debt.lastInterestCalcDate, eventDate);
          if (days > 0) {
            const interest = debt.principal * (debt.interestRate / 100) * (days / 30);
            if (interest > 0.01) {
              debt.accumulatedInterest += interest;
              debt.lastInterestCalcDate = eventDate;
              runningSaldo += interest;
              virtualIdCounter--;
              simulatedDetalles.push({
                tipo: "INTERES",
                id: virtualIdCounter,
                fecha: eventDate.toISOString(),
                descripcion: `Intereses devengados sobre saldo principal (${debt.tipo === "HONORARIO" ? "Honorarios" : "Gastos"})`,
                montoPesos: interest,
                debe: interest,
                haber: 0,
                monedaOriginal: debt.currency as any,
                cantidadOriginal: 0,
                cotizacionArs: null,
                estado: null,
              });
            }
          }
        } else {
          debt.lastInterestCalcDate = eventDate;
        }
      });

      // 4. Procesar evento
      if (event.type === "debe") {
        activeDebts.push({
          id: event.id,
          tipo: event.tipoMov,
          currency: event.currency,
          principal: event.principal,
          interestRate: event.interestRate,
          lastInterestCalcDate: eventDate,
          fechaRegulacion: eventDate,
          accumulatedInterest: 0,
        });

        let debeValue = 0;
        if (event.currency === "JUS") {
          debeValue = event.principal * eventJusRate;
          runningJus += event.principal;
        } else {
          debeValue = event.principal;
        }

        if (event.tipoMov === "HONORARIO") {
          totalHonorariosPesos += debeValue;
        } else {
          totalGastosPesos += debeValue;
        }

        runningSaldo += debeValue;

        simulatedDetalles.push({
          ...event.source,
          montoPesos: debeValue,
          debe: debeValue,
          haber: 0,
        });

      } else if (event.type === "haber") {
        let remainingPayment = event.amount;
        const paymentCurrency = event.currency;
        let paidJusCapital = 0;

        // Primero pagar intereses
        for (const debt of activeDebts) {
          if (debt.currency === paymentCurrency && debt.accumulatedInterest > 0) {
            const pay = Math.min(remainingPayment, debt.accumulatedInterest);
            debt.accumulatedInterest -= pay;
            remainingPayment -= pay;
            if (remainingPayment <= 0) break;
          }
        }

        // Luego pagar capital
        if (remainingPayment > 0) {
          for (const debt of activeDebts) {
            if (debt.currency === paymentCurrency && debt.principal > 0) {
              const pay = Math.min(remainingPayment, debt.principal);
              debt.principal -= pay;
              remainingPayment -= pay;
              if (paymentCurrency === "JUS") paidJusCapital += pay;
              if (remainingPayment <= 0) break;
            }
          }
        }

        let haberValue = 0;
        if (event.currency === "JUS") {
          haberValue = Number(event.amountPesos ?? event.amount * eventJusRate);
          runningJus = Math.max(0, runningJus - paidJusCapital);
        } else {
          haberValue = event.amount;
        }
        totalIngresosPesos += haberValue;

        runningSaldo -= haberValue;

        simulatedDetalles.push({
          ...event.source,
          montoPesos: haberValue,
          debe: 0,
          haber: haberValue,
        });
      }
    });

    // 5. Ajuste JUS final
    if (runningJus > 0 && lastJusRate > 0 && valorJusActualNum > 0 && valorJusActualNum !== lastJusRate) {
      const adjustment = runningJus * (valorJusActualNum - lastJusRate);
      if (Math.abs(adjustment) > 0.01) {
        runningSaldo += adjustment;
        virtualIdCounter--;
        simulatedDetalles.push({
          tipo: "AJUSTE",
          id: virtualIdCounter,
          fecha: today.toISOString(),
          descripcion: `Ajuste por Actualización JUS (${runningJus.toFixed(2)} JUS adeudados)`,
          montoPesos: Math.abs(adjustment),
          debe: adjustment > 0 ? Math.abs(adjustment) : 0,
          haber: adjustment < 0 ? Math.abs(adjustment) : 0,
          monedaOriginal: "ARS",
          cantidadOriginal: 0,
          cotizacionArs: null,
          estado: null,
        });
      }
    }

    // 6. Intereses finales
    let finalSaldoPendiente = runningSaldo;
    activeDebts.forEach((debt) => {
      if (debt.principal > 0 && debt.interestRate > 0) {
        const days = getDaysBetween(debt.lastInterestCalcDate, today);
        if (days > 0) {
          const interest = debt.principal * (debt.interestRate / 100) * (days / 30);
          if (interest > 0.01) {
            debt.accumulatedInterest += interest;
            debt.lastInterestCalcDate = today;
            finalSaldoPendiente += interest;
            virtualIdCounter--;
            simulatedDetalles.push({
              tipo: "INTERES",
              id: virtualIdCounter,
              fecha: today.toISOString(),
              descripcion: `Intereses devengados sobre capital restante (${debt.tipo === "HONORARIO" ? "Honorarios" : "Gastos"})`,
              montoPesos: interest,
              debe: interest,
              haber: 0,
              monedaOriginal: debt.currency as any,
              cantidadOriginal: 0,
              cotizacionArs: null,
              estado: null,
            });
          }
        }
      }
    });

    const saldoPendientePesos = finalSaldoPendiente;

    const finalTotalHonorarios = consolidada ? Number(consolidada.honorarios) : sum(detallesHonorarios);
    const finalTotalGastos = consolidada ? Number(consolidada.gastos) : sum(detallesGastos);

    // Calcular parámetros para el deck del cliente o expediente
    const totalJusDevengados = honorarios.reduce((acc, h) => acc + Number(h.jus ?? 0), 0);
    const totalJusCobrados = ingresos.reduce((acc, ing) => {
      const cotizacion = Number(ing.cotizacionArs || 0);
      if (cotizacion > 0) return acc + (Number(ing.monto) / cotizacion);
      return acc;
    }, 0);
    const totalCargosPesos = finalTotalHonorarios + finalTotalGastos;
    const totalIngresosPesosAcumulado = totalIngresosPesos;

    const lineas: LineaLiquidacion[] = simulatedDetalles.map((detalle) => {
      const monedaOriginal = detalle.monedaOriginal as MonedaOriginal | undefined;
      const cotizacion = detalle.cotizacionArs !== undefined && detalle.cotizacionArs !== null
        ? Number(detalle.cotizacionArs)
        : (monedaOriginal === "JUS" ? valorJusActualNum : null);
      const esEstimado = monedaOriginal === "JUS" && (cotizacion === null || cotizacion === valorJusActualNum);
      const cantidadOriginal = Number(detalle.cantidadOriginal ?? 0);
      const montoPesosLinea = Number(detalle.montoPesos ?? 0);
      const jusLinea = monedaOriginal === "JUS"
        ? cantidadOriginal
        : (detalle.jusAplicados !== undefined ? Number(detalle.jusAplicados ?? 0) : 0);
      const capital = {
        jus: detalle.tipo === "INTERES" ? 0 : jusLinea,
        pesos: detalle.tipo === "INTERES" ? 0 : montoPesosLinea,
        valorJusAplicado: cotizacion,
        esEstimado,
      };
      const interes = {
        jus: 0,
        pesos: detalle.tipo === "INTERES" ? montoPesosLinea : 0,
        valorJusAplicado: cotizacion,
        esEstimado,
      };
      return {
        ...detalle,
        capital,
        interes,
        saldo: {
          jus: capital.jus,
          pesos: capital.pesos + interes.pesos,
          valorJusAplicado: cotizacion,
          esEstimado,
        },
      };
    });

    const capitalJus = lineas.reduce((acc, linea) => acc + (linea.tipo === "INGRESO" ? -linea.capital.jus : linea.capital.jus), 0);
    const interesPesosTotal = lineas.reduce((acc, linea) => acc + linea.interes.pesos, 0);

    return serializeDates({
      detalles: simulatedDetalles,
      lineas,
      cotizacion: {
        valorJusActual: valorJusActualNum,
        fechaCorte: today.toISOString(),
      },
      totales: {
        capitalJus,
        capitalPesos: finalTotalHonorarios + finalTotalGastos,
        interesPesos: interesPesosTotal,
        saldoTotalPesos: consolidada ? Number(consolidada.saldo) : saldoPendientePesos,
        saldoTotalJus: capitalJus,
      },
      leyenda: "Los saldos en JUS con politica AL_COBRO son estimados: se valuan en pesos con la cotizacion vigente al corte y pueden variar al momento del cobro.",
      totalHonorariosPesos: finalTotalHonorarios,
      totalGastosPesos: finalTotalGastos,
      totalIngresosPesos: consolidada ? Number(consolidada.ingresos) : totalIngresosPesos,
      saldoPendientePesos: consolidada ? Number(consolidada.saldo) : saldoPendientePesos,
      deudaReal: {
        jusDevengados: totalJusDevengados,
        jusCobrados: totalJusCobrados,
        saldoJus: totalJusDevengados - totalJusCobrados,
        valorJusActual: valorJusActualNum,
        cargosPesos: totalCargosPesos,
        ingresosPesos: consolidada ? Number(consolidada.ingresos) : totalIngresosPesosAcumulado,
        saldoRealPesos: consolidada ? Number(consolidada.saldo) : saldoPendientePesos,
      },
      estadoFinanciero: (consolidada ? Number(consolidada.saldo) : saldoPendientePesos) <= 0 ? "Al Día" : "Deudor",
    });
  }
}

function sum(items: LiquidacionDetalle[]) {
  return items.reduce((acc, item) => acc + item.montoPesos, 0);
}

function totalHonorariosFor(casoId: SQL) {
  return sql<string>`(
    select coalesce(sum(${honorarios.montoPesos}), 0)::numeric(14,2)
    from ${honorarios}
    where ${honorarios.estudioId} = ${casos.estudioId}
      and ${honorarios.casoId} = ${casoId}
      and ${honorarios.deletedAt} is null
  )`;
}

function totalGastosFor(casoId: SQL) {
  return sql<string>`(
    select coalesce(sum(${gastos.monto} * coalesce(${gastos.cotizacionArs}, 1)), 0)::numeric(14,2)
    from ${gastos}
    where ${gastos.estudioId} = ${casos.estudioId}
      and ${gastos.casoId} = ${casoId}
      and ${gastos.deletedAt} is null
  )`;
}

function totalIngresosFor(casoId: SQL) {
  return sql<string>`(
    select coalesce(sum(${ingresos.monto}), 0)::numeric(14,2)
    from ${ingresos}
    where ${ingresos.estudioId} = ${casos.estudioId}
      and ${ingresos.casoId} = ${casoId}
      and ${ingresos.deletedAt} is null
  )`;
}
