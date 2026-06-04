import { TercerosQueries } from "../db/queries/terceros.queries.js";
import { serializeDates } from "../utils/serialize.js";
import type { CreateTerceroInput, UpdateTerceroInput } from "../schemas/terceros.schema.js";

export class TercerosService {
  static async findAll(estudioId: number, page: number = 1, limit: number = 20, search?: string) {
    const offset = (page - 1) * limit;
    const { data, count } = await TercerosQueries.findAll(estudioId, limit, offset, search);

    return {
      data: {
        items: serializeDates(data),
        meta: {
          total: count,
          page,
          limit,
        },
      },
    };
  }

  static async findById(id: number, estudioId: number) {
    const tercero = await TercerosQueries.findById(id, estudioId);
    if (!tercero) throw new Error("TERCERO_NOT_FOUND");
    return serializeDates(tercero);
  }

  static async create(estudioId: number, userId: number, data: CreateTerceroInput) {
    const { fechaNacimiento, ...rest } = data;
    const nuevoTercero = await TercerosQueries.insert({
      ...rest,
      estudioId,
      createdBy: userId,
      fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
    });
    return serializeDates(nuevoTercero);
  }

  static async update(id: number, estudioId: number, userId: number, data: UpdateTerceroInput) {
    await this.findById(id, estudioId);

    const { fechaNacimiento, ...rest } = data;
    const updateData: any = {
      ...rest,
      updatedAt: new Date(),
      updatedBy: userId,
    };
    if (fechaNacimiento !== undefined) {
      updateData.fechaNacimiento = fechaNacimiento ? new Date(fechaNacimiento) : null;
    }

    const updatedTercero = await TercerosQueries.update(id, estudioId, updateData);
    return serializeDates(updatedTercero);
  }

  static async delete(id: number, estudioId: number, userId: number) {
    await this.findById(id, estudioId);

    const deletedTercero = await TercerosQueries.delete(id, estudioId, userId);
    return serializeDates(deletedTercero);
  }
}
