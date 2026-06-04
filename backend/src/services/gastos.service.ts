import { CasosQueries } from "../db/queries/casos.queries.js";
import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { GastosQueries } from "../db/queries/gastos.queries.js";
import { serializeDates } from "../utils/serialize.js";
import type { CreateGastoInput, GastoQueryInput, UpdateGastoInput } from "../schemas/gastos.schema.js";
import { AuditoriaService, calcDiff } from "./auditoria.service.js";

export class GastosService {
  static async findAll(estudioId: number, query: GastoQueryInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const { data, count } = await GastosQueries.findGastos(
      estudioId,
      {
        clienteId: query.clienteId,
        casoId: query.casoId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      { limit, offset }
    );

    return {
      data: {
        items: data.map(normalizeGasto),
        meta: { total: count, page, limit },
      },
    };
  }

  static async create(estudioId: number, userId: number, data: CreateGastoInput) {
    await this.ensureRelatedEntities(estudioId, data.clienteId, data.casoId ?? undefined);

    const gasto = await GastosQueries.insertGasto({
      estudioId,
      clienteId: data.clienteId,
      casoId: data.casoId ?? null,
      conceptoId: data.conceptoId ?? null,
      descripcion: data.descripcion ?? null,
      fechaGasto: new Date(data.fechaGasto),
      monto: data.monto.toFixed(2),
      monedaId: data.monedaId ?? null,
      cotizacionArs: data.cotizacionArs !== undefined && data.cotizacionArs !== null ? data.cotizacionArs.toFixed(4) : null,
      estadoId: data.estadoId ?? null,
      createdBy: userId,
    });

    await AuditoriaService.log({
      estudioId,
      usuarioId: userId,
      entidad: "gasto",
      entidadId: gasto.id,
      accion: "CREATE",
      descripcion: "Gasto creado",
    });
    return normalizeGasto(gasto);
  }

  static async update(id: number, estudioId: number, userId: number, data: UpdateGastoInput) {
    const current = await GastosQueries.findGastoById(id, estudioId);
    if (!current) throw new Error("GASTO_NOT_FOUND");

    await this.ensureRelatedEntities(estudioId, data.clienteId ?? undefined, data.casoId ?? undefined);

    const updateData: Parameters<typeof GastosQueries.updateGasto>[2] = { updatedAt: new Date(), updatedBy: userId };
    if (data.clienteId !== undefined) updateData.clienteId = data.clienteId;
    if (data.casoId !== undefined) updateData.casoId = data.casoId;
    if (data.conceptoId !== undefined) updateData.conceptoId = data.conceptoId;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.fechaGasto !== undefined) updateData.fechaGasto = new Date(data.fechaGasto);
    if (data.monto !== undefined) updateData.monto = data.monto.toFixed(2);
    if (data.monedaId !== undefined) updateData.monedaId = data.monedaId;
    if (data.cotizacionArs !== undefined) updateData.cotizacionArs = data.cotizacionArs !== null ? data.cotizacionArs.toFixed(4) : null;
    if (data.estadoId !== undefined) updateData.estadoId = data.estadoId;

    const gasto = await GastosQueries.updateGasto(id, estudioId, updateData);
    if (!gasto) throw new Error("GASTO_NOT_FOUND");
    const diff = calcDiff(normalizeGasto(current) as Record<string, unknown>, normalizeGasto(gasto) as Record<string, unknown>);
    if (diff) {
      await AuditoriaService.log({
        estudioId,
        usuarioId: userId,
        entidad: "gasto",
        entidadId: id,
        accion: "UPDATE",
        descripcion: "Gasto actualizado",
        cambios: diff,
      });
    }
    return normalizeGasto(gasto);
  }

  static async delete(id: number, estudioId: number, userId: number) {
    const deleted = await GastosQueries.deleteGasto(id, estudioId, userId);
    if (!deleted) throw new Error("GASTO_NOT_FOUND");
    await AuditoriaService.log({
      estudioId,
      usuarioId: userId,
      entidad: "gasto",
      entidadId: id,
      accion: "DELETE",
      descripcion: "Gasto eliminado",
    });
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
}

export function normalizeGasto<T extends { monto: string; cotizacionArs: string | null }>(gasto: T) {
  return serializeDates({
    ...gasto,
    monto: Number(gasto.monto),
    cotizacionArs: gasto.cotizacionArs !== null ? Number(gasto.cotizacionArs) : null,
  });
}
