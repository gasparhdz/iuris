import { and, eq, inArray, isNull } from "drizzle-orm";
import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { CasosQueries } from "../db/queries/casos.queries.js";
import { GastosQueries } from "../db/queries/gastos.queries.js";
import { HonorariosQueries } from "../db/queries/honorarios.queries.js";
import { IngresosQueries } from "../db/queries/ingresos.queries.js";
import { PlanesQueries } from "../db/queries/planes.queries.js";
import { TercerosQueries } from "../db/queries/terceros.queries.js";
import { db } from "../db/index.js";
import { gastos, honorarios, ingresoAplicaciones, ingresos, planCuotas, planesPago } from "../db/schema.js";
import { ValorJusService } from "./valorjus.service.js";
import { ValorJusQueries } from "../db/queries/valorjus.queries.js";
import {
  buildCuentaCorriente,
  type CCAplicacion,
  type CCGasto,
  type CCHonorario,
  type CCIngreso,
  type CCResult,
} from "./cuenta-corriente.js";
import {
  atribuirMontosPorDeudor,
  deudorKey,
  honorarioDeudorEsCliente,
  honorarioDeudorEsTercero,
  resolveHonorarioDeudor,
  type DeudorResuelto,
} from "./honorario-deudor.js";
import type { CuentaCorrienteResumenQueryInput } from "../schemas/clientes.schema.js";
import { fetchAllRows } from "../utils/fetch-all-rows.js";

type CCHonorarioConMeta = CCHonorario & {
  clienteId: number | null;
  obligadoClienteId: number | null;
  obligadoTerceroId: number | null;
};

type CCGastoConMeta = CCGasto & { clienteId: number | null };
type CCIngresoConMeta = CCIngreso & {
  clienteId: number | null;
  id: number;
  obligadoClienteId?: number | null;
  obligadoTerceroId?: number | null;
};

export type CCResumenDeudor = {
  tipoDeudor: "cliente" | "tercero";
  clienteId: number | null;
  terceroId: number | null;
  deudorNombre: string;
  totales: CCResult["totales"];
};

/**
 * Carga los datos reales (honorarios + planes/cuotas/aplicaciones, gastos,
 * ingresos) y delega el cálculo al motor Decimal de cuenta-corriente.ts.
 * Los saldos pivotan sobre el DEUDOR del honorario (obligado), no sobre clienteId del caso.
 */
export class CuentaCorrienteService {
  static async getCuentaCorrienteCliente(clienteId: number, estudioId: number): Promise<CCResult> {
    const cliente = await ClientesQueries.findById(clienteId, estudioId);
    if (!cliente) throw new Error("CLIENTE_NOT_FOUND");

    const datos = await this.loadDatos(estudioId, {});
    const honorariosCliente = datos.honorarios.filter((h) => honorarioDeudorEsCliente(h, clienteId));
    const ingresosCliente = await this.filterIngresosParaDeudor(
      estudioId,
      datos.ingresos,
      { tipo: "cliente", id: clienteId },
      datos.honorarios,
      clienteId,
    );
    const gastosCliente = datos.gastos.filter((g) => g.clienteId === clienteId);

    return buildCuentaCorriente({
      fechaCorte: datos.fechaCorte,
      valorJusActual: datos.valorJusActual,
      valoresJus: datos.valoresJus,
      honorarios: honorariosCliente,
      gastos: gastosCliente,
      ingresos: ingresosCliente,
    });
  }

  /** Libro mayor del deudor-tercero (honorarios/cuotas imputados; sin gastos). */
  static async getCuentaCorrienteTercero(terceroId: number, estudioId: number): Promise<CCResult> {
    const tercero = await TercerosQueries.findById(terceroId, estudioId);
    if (!tercero) throw new Error("TERCERO_NOT_FOUND");

    const datos = await this.loadDatos(estudioId, {});
    const honorariosTercero = datos.honorarios.filter((h) => honorarioDeudorEsTercero(h, terceroId));
    const ingresosTercero = await this.filterIngresosParaDeudor(
      estudioId,
      datos.ingresos,
      { tipo: "tercero", id: terceroId },
      datos.honorarios,
      null,
    );

    return buildCuentaCorriente({
      fechaCorte: datos.fechaCorte,
      valorJusActual: datos.valorJusActual,
      valoresJus: datos.valoresJus,
      honorarios: honorariosTercero,
      gastos: [],
      ingresos: ingresosTercero,
    });
  }

  static async getCuentaCorrienteCaso(casoId: number, estudioId: number): Promise<CCResult> {
    const caso = await CasosQueries.findById(casoId, estudioId);
    if (!caso) throw new Error("CASO_NOT_FOUND");
    const datos = await this.loadDatos(estudioId, { casoId });
    return buildCuentaCorriente(datos);
  }

  /** Resumen de cuenta corriente por deudor (cliente o tercero) para todo el estudio. */
  static async getResumenPorCliente(estudioId: number, query: CuentaCorrienteResumenQueryInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { orderBy = "saldo", order = "desc", search } = query;
    const datos = await this.loadDatos(estudioId, {});

    type Grupo = {
      deudor: DeudorResuelto;
      honorarios: CCHonorarioConMeta[];
      gastos: CCGastoConMeta[];
      ingresos: CCIngresoConMeta[];
    };

    const grupos = new Map<string, Grupo>();
    const ensure = (deudor: DeudorResuelto) => {
      const key = deudorKey(deudor);
      if (!grupos.has(key)) {
        grupos.set(key, { deudor, honorarios: [], gastos: [], ingresos: [] });
      }
      return grupos.get(key)!;
    };

    for (const h of datos.honorarios) {
      const deudor = resolveHonorarioDeudor(h);
      if (!deudor) continue;
      ensure(deudor).honorarios.push(h);
    }

    // Gastos siempre van al cliente del gasto.
    for (const g of datos.gastos) {
      if (!g.clienteId) continue;
      ensure({ tipo: "cliente", id: g.clienteId }).gastos.push(g);
    }

    // Ingresos: atribuir al deudor de las deudas imputadas (monto partido por aplicación);
    // el sobrante no imputado (saldo a favor) va al obligado del ingreso (o cliente como legado).
    const ingresoDeudores = await this.mapIngresosADeudores(estudioId, datos.ingresos, datos.honorarios);
    for (const ingreso of datos.ingresos) {
      const atribuciones = ingresoDeudores.get(ingreso.id) ?? [];
      for (const { deudor, monto } of atribuciones) {
        ensure(deudor).ingresos.push({ ...ingreso, monto: monto.toFixed(2) });
      }
      const aplicadoTotal = atribuciones.reduce((acc, a) => acc + a.monto, 0);
      const sobrante = Math.max(Number(ingreso.monto) - aplicadoTotal, 0);
      if (sobrante > 0.01) {
        const deudorPropio: DeudorResuelto | null = ingreso.obligadoTerceroId != null
          ? { tipo: "tercero", id: ingreso.obligadoTerceroId }
          : ((ingreso.obligadoClienteId ?? ingreso.clienteId) != null
              ? { tipo: "cliente", id: (ingreso.obligadoClienteId ?? ingreso.clienteId)! }
              : null);
        if (deudorPropio) {
          ensure(deudorPropio).ingresos.push({ ...ingreso, monto: sobrante.toFixed(2) });
        }
      }
    }

    const clientes = await fetchAllRows((p) => ClientesQueries.findAll(estudioId, p.limit, p.offset, {}));
    const clientesById = new Map(clientes.map((c) => [c.id, c]));
    const tercerosList = await fetchAllRows((p) => TercerosQueries.findAll(estudioId, p.limit, p.offset));
    const tercerosById = new Map(tercerosList.map((t) => [t.id, t]));

    const formatPersona = (p: {
      razonSocial?: string | null;
      apellido?: string | null;
      nombre?: string | null;
    } | undefined, fallback: string) => {
      if (!p) return fallback;
      if (p.razonSocial) return p.razonSocial;
      const compuesto = [p.apellido, p.nombre].filter(Boolean).join(", ");
      return compuesto || p.nombre || fallback;
    };

    const rows = [...grupos.values()].map((grupo) => {
      const totales = buildCuentaCorriente({
        fechaCorte: datos.fechaCorte,
        valorJusActual: datos.valorJusActual,
        valoresJus: datos.valoresJus,
        honorarios: grupo.honorarios,
        gastos: grupo.gastos,
        ingresos: grupo.ingresos,
      }).totales;

      const tipoDeudor = grupo.deudor.tipo;
      const clienteId = tipoDeudor === "cliente" ? grupo.deudor.id : null;
      const terceroId = tipoDeudor === "tercero" ? grupo.deudor.id : null;
      const deudorNombre = tipoDeudor === "cliente"
        ? formatPersona(clientesById.get(grupo.deudor.id), `Cliente #${grupo.deudor.id}`)
        : formatPersona(tercerosById.get(grupo.deudor.id), `Tercero #${grupo.deudor.id}`);

      const totalCargos = Number(totales.honorariosPesos ?? 0) + Number(totales.gastosPesos ?? 0);
      const totalCobrado = Number(totales.ingresosPesos ?? 0);
      const saldoPendiente = Number(totales.saldoPesos ?? 0);

      return {
        tipoDeudor,
        clienteId,
        terceroId,
        deudorNombre,
        totales,
        totalCargos,
        totalCobrado,
        saldoPendiente,
        estadoFinanciero: saldoPendiente > 0 ? "Deudor" : "Al Dia",
      };
    });

    const searchTerm = search?.trim().toLowerCase();
    const filtered = searchTerm
      ? rows.filter((row) => [row.deudorNombre, row.estadoFinanciero, row.tipoDeudor].join(" ").toLowerCase().includes(searchTerm))
      : rows;

    const compare = (a: number | string, b: number | string) => {
      if (typeof a === "number" && typeof b === "number") return a - b;
      return String(a).localeCompare(String(b), "es", { sensitivity: "base" });
    };

    const sorted = [...filtered].sort((a, b) => {
      let valA: number | string;
      let valB: number | string;
      switch (orderBy) {
        case "cliente":
          valA = a.deudorNombre;
          valB = b.deudorNombre;
          break;
        case "cargos":
          valA = a.totalCargos;
          valB = b.totalCargos;
          break;
        case "cobrado":
          valA = a.totalCobrado;
          valB = b.totalCobrado;
          break;
        case "estado":
          valA = a.estadoFinanciero;
          valB = b.estadoFinanciero;
          break;
        case "saldo":
        default:
          valA = a.saldoPendiente;
          valB = b.saldoPendiente;
      }
      const cmp = compare(valA, valB);
      if (cmp !== 0) return order === "desc" ? -cmp : cmp;
      const idA = a.clienteId ?? a.terceroId ?? 0;
      const idB = b.clienteId ?? b.terceroId ?? 0;
      return idA - idB;
    });

    const offset = (page - 1) * limit;
    const items: CCResumenDeudor[] = sorted.slice(offset, offset + limit).map((row) => ({
      tipoDeudor: row.tipoDeudor,
      clienteId: row.clienteId,
      terceroId: row.terceroId,
      deudorNombre: row.deudorNombre,
      totales: row.totales,
    }));

    return {
      items,
      meta: { total: filtered.length, page, limit },
    };
  }

  /**
   * Atribuye cada ingreso a los deudores de las deudas imputadas, partiendo el monto
   * por aplicación (cada app va al deudor de su deuda). Sin apps → caller usa clienteId.
   */
  private static async mapIngresosADeudores(
    estudioId: number,
    ingresosList: CCIngresoConMeta[],
    honorariosList: CCHonorarioConMeta[],
  ): Promise<Map<number, Array<{ deudor: DeudorResuelto; monto: number }>>> {
    const result = new Map<number, Array<{ deudor: DeudorResuelto; monto: number }>>();
    if (ingresosList.length === 0) return result;

    const honorarioById = new Map(honorariosList.map((h) => [h.id, h]));
    const ingresoIds = ingresosList.map((i) => i.id);
    if (ingresoIds.length === 0) return result;

    const apps = await db
      .select({
        ingresoId: ingresoAplicaciones.ingresoId,
        honorarioId: ingresoAplicaciones.honorarioId,
        cuotaId: ingresoAplicaciones.cuotaId,
        gastoId: ingresoAplicaciones.gastoId,
        montoCapital: ingresoAplicaciones.montoCapital,
        montoInteres: ingresoAplicaciones.montoInteres,
      })
      .from(ingresoAplicaciones)
      .innerJoin(ingresos, eq(ingresoAplicaciones.ingresoId, ingresos.id))
      .where(and(
        inArray(ingresoAplicaciones.ingresoId, ingresoIds),
        eq(ingresoAplicaciones.activo, true),
        isNull(ingresoAplicaciones.deletedAt),
        isNull(ingresos.deletedAt),
        eq(ingresos.estudioId, estudioId),
      ));

    const cuotaIds = [...new Set(apps.map((a) => a.cuotaId).filter((id): id is number => id != null))];
    const cuotaToHonorario = new Map<number, number>();
    if (cuotaIds.length > 0) {
      const cuotaRows = await db
        .select({
          cuotaId: planCuotas.id,
          honorarioId: planesPago.honorarioId,
        })
        .from(planCuotas)
        .innerJoin(planesPago, eq(planCuotas.planId, planesPago.id))
        .where(inArray(planCuotas.id, cuotaIds));
      for (const row of cuotaRows) {
        cuotaToHonorario.set(row.cuotaId, row.honorarioId);
      }
    }

    // Honorarios referenciados por cuota / app que no estaban en la lista cargada.
    const referencedHonorarioIds = new Set<number>();
    for (const app of apps) {
      if (app.honorarioId) referencedHonorarioIds.add(app.honorarioId);
    }
    for (const honorarioId of cuotaToHonorario.values()) {
      referencedHonorarioIds.add(honorarioId);
    }
    const missingHonorarioIds = [...referencedHonorarioIds].filter((id) => !honorarioById.has(id));
    if (missingHonorarioIds.length > 0) {
      const missing = await db
        .select({
          id: honorarios.id,
          clienteId: honorarios.clienteId,
          obligadoClienteId: honorarios.obligadoClienteId,
          obligadoTerceroId: honorarios.obligadoTerceroId,
        })
        .from(honorarios)
        .where(and(
          eq(honorarios.estudioId, estudioId),
          inArray(honorarios.id, missingHonorarioIds),
          isNull(honorarios.deletedAt),
        ));
      for (const h of missing) {
        honorarioById.set(h.id, {
          id: h.id,
          clienteId: h.clienteId,
          obligadoClienteId: h.obligadoClienteId,
          obligadoTerceroId: h.obligadoTerceroId,
        } as CCHonorarioConMeta);
      }
    }

    // Gastos: deudor = cliente del gasto (o del ingreso como fallback).
    const gastoIds = [...new Set(apps.map((a) => a.gastoId).filter((id): id is number => id != null))];
    const gastoClienteById = new Map<number, number>();
    if (gastoIds.length > 0) {
      const gastoRows = await db
        .select({ id: gastos.id, clienteId: gastos.clienteId })
        .from(gastos)
        .where(and(eq(gastos.estudioId, estudioId), inArray(gastos.id, gastoIds)));
      for (const g of gastoRows) {
        if (g.clienteId != null) gastoClienteById.set(g.id, g.clienteId);
      }
    }

    const appsByIngreso = new Map<number, typeof apps>();
    for (const app of apps) {
      const list = appsByIngreso.get(app.ingresoId) ?? [];
      list.push(app);
      appsByIngreso.set(app.ingresoId, list);
    }

    for (const [ingresoId, ingresoApps] of appsByIngreso) {
      const resolved = ingresoApps.map((app) => {
        let honorarioId = app.honorarioId;
        if (!honorarioId && app.cuotaId) {
          honorarioId = cuotaToHonorario.get(app.cuotaId) ?? null;
        }

        let deudor: DeudorResuelto | null = null;
        if (honorarioId) {
          const h = honorarioById.get(honorarioId);
          if (h) deudor = resolveHonorarioDeudor(h);
        } else if (app.gastoId) {
          const gastoClienteId = gastoClienteById.get(app.gastoId);
          if (gastoClienteId != null) {
            deudor = { tipo: "cliente", id: gastoClienteId };
          } else {
            const ingreso = ingresosList.find((i) => i.id === ingresoId);
            if (ingreso?.clienteId) deudor = { tipo: "cliente", id: ingreso.clienteId };
          }
        }

        return {
          deudor,
          montoCapital: Number(app.montoCapital ?? 0),
          montoInteres: Number(app.montoInteres ?? 0),
        };
      });

      const atribuciones = atribuirMontosPorDeudor(resolved);
      if (atribuciones.length > 0) result.set(ingresoId, atribuciones);
    }

    return result;
  }

  private static async filterIngresosParaDeudor(
    estudioId: number,
    ingresosList: CCIngresoConMeta[],
    deudor: DeudorResuelto,
    honorariosList: CCHonorarioConMeta[],
    fallbackClienteId: number | null,
  ): Promise<CCIngresoConMeta[]> {
    const map = await this.mapIngresosADeudores(estudioId, ingresosList, honorariosList);

    // Deudor "propio" del ingreso (quién pagó): obligado explícito, o el cliente como legado.
    const deudorPropio = (ingreso: CCIngresoConMeta): DeudorResuelto | null => {
      if (ingreso.obligadoTerceroId != null) return { tipo: "tercero", id: ingreso.obligadoTerceroId };
      const clienteId = ingreso.obligadoClienteId ?? ingreso.clienteId ?? null;
      return clienteId != null ? { tipo: "cliente", id: clienteId } : null;
    };
    const esDeudor = (d: DeudorResuelto | null) => d !== null && d.tipo === deudor.tipo && d.id === deudor.id;

    const result: CCIngresoConMeta[] = [];
    for (const ingreso of ingresosList) {
      const atribuciones = map.get(ingreso.id) ?? [];
      const aplicadoTotal = atribuciones.reduce((acc, a) => acc + a.monto, 0);
      const match = atribuciones.find((a) => esDeudor(a.deudor));
      // El sobrante no imputado (saldo a favor) es del deudor propio del ingreso.
      const sobrante = Math.max(Number(ingreso.monto) - aplicadoTotal, 0);
      let monto = match?.monto ?? 0;
      if (sobrante > 0.01 && esDeudor(deudorPropio(ingreso))) monto += sobrante;
      // Legado: ingresos sin aplicaciones y sin obligado, atribuidos por clienteId.
      if (monto <= 0.01 && atribuciones.length === 0 && deudorPropio(ingreso) === null
        && deudor.tipo === "cliente" && fallbackClienteId != null && ingreso.clienteId === fallbackClienteId) {
        monto = Number(ingreso.monto);
      }
      if (monto > 0.01) result.push({ ...ingreso, monto: monto.toFixed(2) });
    }
    return result;
  }

  private static async loadDatos(estudioId: number, filters: { clienteId?: number; casoId?: number }) {
    const fechaCorte = new Date();
    const [honorariosRows, gastos, ingresosRows, valorJusActual, planes, valoresJus] = await Promise.all([
      fetchAllRows((p) => HonorariosQueries.findHonorarios(estudioId, filters, p)),
      fetchAllRows((p) => GastosQueries.findGastos(estudioId, filters, p)),
      fetchAllRows((p) => IngresosQueries.findIngresos(estudioId, filters, p)),
      ValorJusService.getValorJusSnapshot(fechaCorte, estudioId),
      PlanesQueries.findPlanes(estudioId, filters),
      ValorJusQueries.findHistorialActivo(),
    ]);

    const parametroCache = new Map<number, Awaited<ReturnType<typeof HonorariosQueries.findParametroById>>>();
    const getParametroCodigo = async (id: number | null | undefined): Promise<string | null> => {
      if (!id) return null;
      if (!parametroCache.has(id)) parametroCache.set(id, await HonorariosQueries.findParametroById(id));
      return parametroCache.get(id)?.codigo ?? null;
    };

    const planByHonorario = new Map(planes.map((plan) => [plan.honorarioId, plan]));
    const planIds = planes.map((plan) => plan.id);
    const honorarioIdsSinPlan = honorariosRows
      .filter((h) => !planByHonorario.has(h.id))
      .map((h) => h.id);

    const [allCuotas, allAppsPlanes, allAppsDirectas] = await Promise.all([
      PlanesQueries.findCuotasByPlanIds(planIds, estudioId),
      PlanesQueries.findAplicacionesByPlanIds(planIds),
      PlanesQueries.findAplicacionesByHonorarioIds(honorarioIdsSinPlan),
    ]);

    const cuotasByPlanId = new Map<number, typeof allCuotas>();
    for (const cuota of allCuotas) {
      const list = cuotasByPlanId.get(cuota.planId) ?? [];
      list.push(cuota);
      cuotasByPlanId.set(cuota.planId, list);
    }

    const appsByCuotaId = new Map<number, CCAplicacion[]>();
    for (const app of allAppsPlanes) {
      if (app.cuotaId === null) continue;
      const list = appsByCuotaId.get(app.cuotaId) ?? [];
      list.push(toCCAplicacion(app));
      appsByCuotaId.set(app.cuotaId, list);
    }

    const appsByHonorarioId = new Map<number, CCAplicacion[]>();
    for (const app of allAppsDirectas) {
      if (app.honorarioId === null) continue;
      const list = appsByHonorarioId.get(app.honorarioId) ?? [];
      list.push(toCCAplicacion(app));
      appsByHonorarioId.set(app.honorarioId, list);
    }

    const ccHonorarios = await Promise.all(honorariosRows.map(async (honorario): Promise<CCHonorarioConMeta> => {
      const plan = planByHonorario.get(honorario.id) ?? null;

      let ccPlan: CCHonorario["plan"] = null;
      if (plan) {
        const cuotas = cuotasByPlanId.get(plan.id) ?? [];
        ccPlan = {
          tasaInteresMensual: plan.tasaInteresMensual,
          regimenMora: plan.regimenMora,
          politicaCodigo: await getParametroCodigo(plan.politicaJusId),
          valorJusRef: plan.valorJusRef,
          cuotas: cuotas.map((cuota) => ({
            id: cuota.id,
            numero: cuota.numero,
            vencimiento: cuota.vencimiento,
            montoJus: cuota.montoJus,
            montoPesos: cuota.montoPesos,
            valorJusRef: cuota.valorJusRef,
            aplicaciones: appsByCuotaId.get(cuota.id) ?? [],
          })),
        };
      }

      const aplicacionesDirectas = ccPlan
        ? []
        : (appsByHonorarioId.get(honorario.id) ?? []);

      return {
        id: honorario.id,
        clienteId: honorario.clienteId,
        obligadoClienteId: honorario.obligadoClienteId ?? null,
        obligadoTerceroId: honorario.obligadoTerceroId ?? null,
        descripcion: honorario.concepto?.nombre ?? "Honorario",
        fechaRegulacion: honorario.fechaRegulacion,
        fechaVencimiento: honorario.fechaVencimiento,
        jus: honorario.jus,
        montoPesos: honorario.montoPesos,
        valorJusRef: honorario.valorJusRef,
        politicaCodigo: await getParametroCodigo(honorario.politicaJusId),
        monedaCodigo: honorario.moneda?.codigo ?? null,
        tasaInteresMensualPct: honorario.tasaInteresMensual,
        plan: ccPlan,
        aplicaciones: aplicacionesDirectas,
      };
    }));

    const gastosMapped: CCGastoConMeta[] = await Promise.all(gastos.map(async (gasto) => ({
      id: gasto.id,
      clienteId: gasto.clienteId,
      descripcion: gasto.descripcion ?? "Gasto",
      fecha: gasto.fechaGasto,
      monto: gasto.monto,
      monedaCodigo: await getParametroCodigo(gasto.monedaId),
      cotizacionArs: gasto.cotizacionArs,
    })));

    return {
      fechaCorte,
      valorJusActual: String(valorJusActual ?? 0),
      valoresJus,
      honorarios: ccHonorarios,
      gastos: gastosMapped,
      ingresos: ingresosRows.map((ingreso): CCIngresoConMeta => ({
        id: ingreso.id,
        clienteId: ingreso.clienteId,
        obligadoClienteId: ingreso.obligadoClienteId ?? null,
        obligadoTerceroId: ingreso.obligadoTerceroId ?? null,
        descripcion: ingreso.descripcion ?? "Ingreso",
        fecha: ingreso.fechaIngreso,
        monto: ingreso.monto,
      })),
    };
  }
}

function toCCAplicacion(app: { fechaIngreso: Date; montoCapital: string; montoInteres: string; valorJusAlCobro: string | null }): CCAplicacion {
  return {
    fecha: app.fechaIngreso,
    montoCapital: app.montoCapital,
    montoInteres: app.montoInteres,
    valorJusAlCobro: app.valorJusAlCobro,
  };
}
