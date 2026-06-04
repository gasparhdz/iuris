import { IngresosQueries } from "../db/queries/ingresos.queries.js";
import { GastosQueries } from "../db/queries/gastos.queries.js";
import { PlanesQueries } from "../db/queries/planes.queries.js";
import { db } from "../db/index.js";
import { serializeDates } from "../utils/serialize.js";
import { PlanesService } from "./planes.service.js";
import type { IngresoQueryInput, UpdateIngresoInput } from "../schemas/ingresos.schema.js";
import { AuditoriaService, calcDiff } from "./auditoria.service.js";

export class IngresosService {
  static async findAll(estudioId: number, query: IngresoQueryInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const { data, count } = await IngresosQueries.findIngresos(
      estudioId,
      {
        clienteId: query.clienteId,
        casoId: query.casoId,
        cuotaId: query.cuotaId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      { limit, offset }
    );

    return {
      data: {
        items: data.map(normalizeIngreso),
        meta: { total: count, page, limit },
      },
    };
  }

  static async update(id: number, estudioId: number, userId: number, data: UpdateIngresoInput) {
    const current = await IngresosQueries.findIngresoById(id, estudioId);
    if (!current) throw new Error("INGRESO_NOT_FOUND");

    const updateData: Parameters<typeof IngresosQueries.updateIngreso>[2] = { updatedAt: new Date(), updatedBy: userId };
    if (data.clienteId !== undefined) updateData.clienteId = data.clienteId;
    if (data.casoId !== undefined) updateData.casoId = data.casoId;
    if (data.cuotaId !== undefined) updateData.cuotaId = data.cuotaId;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.monto !== undefined) updateData.monto = data.monto.toFixed(2);
    if (data.monedaId !== undefined) updateData.monedaId = data.monedaId;
    if (data.cotizacionArs !== undefined) updateData.cotizacionArs = data.cotizacionArs !== null ? data.cotizacionArs.toFixed(4) : null;
    if (data.fechaIngreso !== undefined) updateData.fechaIngreso = new Date(data.fechaIngreso);
    if (data.tipoId !== undefined) updateData.tipoId = data.tipoId;
    if (data.estadoId !== undefined) updateData.estadoId = data.estadoId;
    if (data.activo !== undefined) updateData.activo = data.activo;

    const ingreso = await IngresosQueries.updateIngreso(id, estudioId, updateData);
    if (!ingreso) throw new Error("INGRESO_NOT_FOUND");

    await this.recomputeAffectedCuotas(estudioId, current.cuotaId, ingreso.cuotaId);
    const diff = calcDiff(normalizeIngreso(current) as Record<string, unknown>, normalizeIngreso(ingreso) as Record<string, unknown>);
    if (diff) {
      await AuditoriaService.log({
        estudioId,
        usuarioId: userId,
        entidad: "ingreso",
        entidadId: id,
        accion: "UPDATE",
        descripcion: "Ingreso actualizado",
        cambios: diff,
      });
    }
    return normalizeIngreso(ingreso);
  }

  static async delete(id: number, estudioId: number, userId: number) {
    const current = await db.transaction(async (tx) => {
      const ingreso = await IngresosQueries.findIngresoById(id, estudioId, tx);
      if (!ingreso) throw new Error("INGRESO_NOT_FOUND");

      const aplicaciones = await PlanesQueries.findAplicacionesByIngresoActivas(id, tx);
      const cuotasAfectadas = new Set(aplicaciones.map((app) => app.cuotaId).filter((cuotaId): cuotaId is number => cuotaId !== null));
      const gastosAfectados = aplicaciones
        .map((app) => app.gastoId)
        .filter((gastoId): gastoId is number => gastoId !== null);

      const deleted = await IngresosQueries.deleteIngreso(id, estudioId, userId, tx);
      if (!deleted) throw new Error("INGRESO_NOT_FOUND");

      await PlanesQueries.deleteAplicacionesByIngreso(id, userId, tx);

      if (ingreso.cuotaId) cuotasAfectadas.add(ingreso.cuotaId);
      for (const cuotaId of cuotasAfectadas) {
        await PlanesService.recomputeCuotaEstado(cuotaId, estudioId, tx);
      }

      if (gastosAfectados.length > 0) {
        const estadoPendiente = await PlanesQueries.findParametroByCodigo("ESTADO_GASTO", "PENDIENTE");
        if (!estadoPendiente) throw new Error("PARAMETRO_PENDIENTE_NOT_FOUND");

        for (const gastoId of new Set(gastosAfectados)) {
          const gasto = await GastosQueries.findGastoById(gastoId, estudioId, tx);
          if (!gasto) continue;
          const totalRestante = await PlanesQueries.sumAplicacionesByGasto(gastoId, tx);
          if (totalRestante < Number(gasto.monto) - 0.0001) {
            await GastosQueries.updateGastoTx(gastoId, estudioId, {
              estadoId: estadoPendiente.id,
              updatedAt: new Date(),
              updatedBy: userId,
            }, tx);
          }
        }
      }
      return ingreso;
    });

    await AuditoriaService.log({
      estudioId,
      usuarioId: userId,
      entidad: "ingreso",
      entidadId: id,
      accion: "DELETE",
      descripcion: "Ingreso eliminado",
    });
  }

  private static async recomputeAffectedCuotas(estudioId: number, previousCuotaId: number | null, nextCuotaId: number | null) {
    if (previousCuotaId) await PlanesService.recomputeCuotaEstado(previousCuotaId, estudioId);
    if (nextCuotaId && nextCuotaId !== previousCuotaId) await PlanesService.recomputeCuotaEstado(nextCuotaId, estudioId);
  }
}

export function normalizeIngreso<T extends { monto: string; cotizacionArs: string | null; valorJusAlCobro?: string | null }>(ingreso: T) {
  return serializeDates({
    ...ingreso,
    monto: Number(ingreso.monto),
    cotizacionArs: ingreso.cotizacionArs !== null ? Number(ingreso.cotizacionArs) : null,
    valorJusAlCobro: ingreso.valorJusAlCobro !== undefined && ingreso.valorJusAlCobro !== null ? Number(ingreso.valorJusAlCobro) : null,
  });
}
