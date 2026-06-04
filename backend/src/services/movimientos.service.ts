import { CasosQueries } from "../db/queries/casos.queries.js";
import { MovimientosQueries } from "../db/queries/movimientos.queries.js";
import { serializeDates } from "../utils/serialize.js";
import type { CreateMovimientoInput, UpdateMovimientoInput } from "../schemas/movimientos.schema.js";

export class MovimientosService {
  static async findMovimientosByCaso(casoId: number, estudioId: number) {
    await this.ensureCaso(casoId, estudioId);
    const movimientos = await MovimientosQueries.findMovimientosByCaso(casoId, estudioId);
    return serializeDates(movimientos);
  }

  static async create(casoId: number, estudioId: number, userId: number, data: CreateMovimientoInput) {
    await this.ensureCaso(casoId, estudioId);

    const movimiento = await MovimientosQueries.insertMovimiento({
      casoId,
      fecha: new Date(data.fecha),
      tipo: data.tipo,
      descripcion: data.descripcion ?? null,
      foja: data.foja ?? null,
      vencimiento: data.vencimiento ? new Date(data.vencimiento) : null,
      createdBy: userId,
    }, estudioId);

    return serializeDates(movimiento);
  }

  static async update(id: number, estudioId: number, data: UpdateMovimientoInput) {
    const updateData: Parameters<typeof MovimientosQueries.updateMovimiento>[1] = {};

    if (data.fecha !== undefined) updateData.fecha = new Date(data.fecha);
    if (data.tipo !== undefined) updateData.tipo = data.tipo;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.foja !== undefined) updateData.foja = data.foja;
    if (data.vencimiento !== undefined) {
      updateData.vencimiento = data.vencimiento ? new Date(data.vencimiento) : null;
    }

    const movimiento = await MovimientosQueries.updateMovimiento(id, updateData, estudioId);
    if (!movimiento) throw new Error("MOVIMIENTO_NOT_FOUND");

    return serializeDates(movimiento);
  }

  static async delete(id: number, estudioId: number) {
    const deleted = await MovimientosQueries.deleteMovimiento(id, estudioId);
    if (!deleted) throw new Error("MOVIMIENTO_NOT_FOUND");
  }

  private static async ensureCaso(casoId: number, estudioId: number) {
    const caso = await CasosQueries.findById(casoId, estudioId);
    if (!caso) throw new Error("CASO_NOT_FOUND");
  }
}
