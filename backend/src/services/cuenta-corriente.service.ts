import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { CasosQueries } from "../db/queries/casos.queries.js";
import { GastosQueries } from "../db/queries/gastos.queries.js";
import { HonorariosQueries } from "../db/queries/honorarios.queries.js";
import { IngresosQueries } from "../db/queries/ingresos.queries.js";
import { PlanesQueries } from "../db/queries/planes.queries.js";
import { ValorJusService } from "./valorjus.service.js";
import { buildCuentaCorriente, type CCAplicacion, type CCGasto, type CCHonorario, type CCIngreso, type CCResult } from "./cuenta-corriente.js";

export type CCResumenCliente = {
  clienteId: number;
  totales: CCResult["totales"];
};

/**
 * Carga los datos reales (honorarios + planes/cuotas/aplicaciones, gastos,
 * ingresos) y delega el cálculo al motor Decimal de cuenta-corriente.ts.
 * El frontend solo renderiza el resultado.
 */
export class CuentaCorrienteService {
  static async getCuentaCorrienteCliente(clienteId: number, estudioId: number): Promise<CCResult> {
    const cliente = await ClientesQueries.findById(clienteId, estudioId);
    if (!cliente) throw new Error("CLIENTE_NOT_FOUND");
    const datos = await this.loadDatos(estudioId, { clienteId });
    return buildCuentaCorriente(datos);
  }

  static async getCuentaCorrienteCaso(casoId: number, estudioId: number): Promise<CCResult> {
    const caso = await CasosQueries.findById(casoId, estudioId);
    if (!caso) throw new Error("CASO_NOT_FOUND");
    const datos = await this.loadDatos(estudioId, { casoId });
    return buildCuentaCorriente(datos);
  }

  /** Resumen de cuenta corriente por cliente para todo el estudio (una sola pasada). */
  static async getResumenPorCliente(estudioId: number): Promise<CCResumenCliente[]> {
    const datos = await this.loadDatos(estudioId, {});

    const grupos = new Map<number, { honorarios: CCHonorario[]; gastos: CCGasto[]; ingresos: CCIngreso[] }>();
    const ensure = (clienteId: number | null) => {
      if (!clienteId) return null;
      if (!grupos.has(clienteId)) grupos.set(clienteId, { honorarios: [], gastos: [], ingresos: [] });
      return grupos.get(clienteId)!;
    };
    datos.honorarios.forEach((h) => ensure(h.clienteId)?.honorarios.push(h));
    datos.gastos.forEach((g) => ensure(g.clienteId)?.gastos.push(g));
    datos.ingresos.forEach((i) => ensure(i.clienteId)?.ingresos.push(i));

    return [...grupos.entries()].map(([clienteId, grupo]) => ({
      clienteId,
      totales: buildCuentaCorriente({
        fechaCorte: datos.fechaCorte,
        valorJusActual: datos.valorJusActual,
        honorarios: grupo.honorarios,
        gastos: grupo.gastos,
        ingresos: grupo.ingresos,
      }).totales,
    }));
  }

  private static async loadDatos(estudioId: number, filters: { clienteId?: number; casoId?: number }) {
    const fechaCorte = new Date();
    const [{ data: honorarios }, { data: gastos }, { data: ingresos }, valorJusActual, planes] = await Promise.all([
      HonorariosQueries.findHonorarios(estudioId, filters, { limit: 10000, offset: 0 }),
      GastosQueries.findGastos(estudioId, filters, { limit: 10000, offset: 0 }),
      IngresosQueries.findIngresos(estudioId, filters, { limit: 10000, offset: 0 }),
      ValorJusService.getValorJusSnapshot(fechaCorte, estudioId),
      PlanesQueries.findPlanes(estudioId, filters),
    ]);

    const parametroCache = new Map<number, Awaited<ReturnType<typeof HonorariosQueries.findParametroById>>>();
    const getParametroCodigo = async (id: number | null | undefined): Promise<string | null> => {
      if (!id) return null;
      if (!parametroCache.has(id)) parametroCache.set(id, await HonorariosQueries.findParametroById(id));
      return parametroCache.get(id)?.codigo ?? null;
    };

    const planByHonorario = new Map(planes.map((plan) => [plan.honorarioId, plan]));

    const ccHonorarios = await Promise.all(honorarios.map(async (honorario): Promise<CCHonorario & { clienteId: number | null }> => {
      const plan = planByHonorario.get(honorario.id) ?? null;

      let ccPlan: CCHonorario["plan"] = null;
      if (plan) {
        const [cuotas, aplicacionesPlan] = await Promise.all([
          PlanesQueries.findCuotasByPlan(plan.id, estudioId),
          PlanesQueries.findAplicacionesByPlanCuotas(plan.id),
        ]);
        const aplicacionesByCuota = new Map<number, CCAplicacion[]>();
        for (const app of aplicacionesPlan) {
          if (app.cuotaId === null) continue;
          const list = aplicacionesByCuota.get(app.cuotaId) ?? [];
          list.push(toCCAplicacion(app));
          aplicacionesByCuota.set(app.cuotaId, list);
        }
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
            aplicaciones: aplicacionesByCuota.get(cuota.id) ?? [],
          })),
        };
      }

      const aplicacionesDirectas = ccPlan
        ? []
        : (await PlanesQueries.findAplicacionesByHonorarioActivas(honorario.id)).map(toCCAplicacion);

      return {
        id: honorario.id,
        clienteId: honorario.clienteId,
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

    return {
      fechaCorte,
      valorJusActual: String(valorJusActual ?? 0),
      honorarios: ccHonorarios,
      gastos: gastos.map((gasto): CCGasto & { clienteId: number | null } => ({
        id: gasto.id,
        clienteId: gasto.clienteId,
        descripcion: gasto.descripcion ?? "Gasto",
        fecha: gasto.fechaGasto,
        monto: gasto.monto,
        cotizacionArs: gasto.cotizacionArs,
      })),
      ingresos: ingresos.map((ingreso): CCIngreso & { clienteId: number | null } => ({
        id: ingreso.id,
        clienteId: ingreso.clienteId,
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
