import { ValorJusQueries } from "../db/queries/valorjus.queries.js";
import { serializeDates } from "../utils/serialize.js";
import type { CreateValorJusInput, UpdateValorJusInput, ValorJusQueryInput } from "../schemas/valorjus.schema.js";

export class ValorJusService {
  static async findActual(estudioId: number, fecha?: Date) {
    const valor = fecha
      ? await ValorJusQueries.findValorJusByFecha(fecha, estudioId)
      : await ValorJusQueries.findValorJusActual(estudioId);
    return normalizeValorJus(valor);
  }

  static async findAll(estudioId: number, query: ValorJusQueryInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const { data, count } = await ValorJusQueries.findValoresJus(
      estudioId,
      {
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      { limit, offset }
    );

    return {
      data: {
        items: data.map(normalizeValorJus),
        meta: { total: count, page, limit },
      },
    };
  }

  static async create(estudioId: number, userId: number, data: CreateValorJusInput) {
    const valor = await ValorJusQueries.insertValorJus({
      estudioId,
      valor: data.valor.toFixed(4),
      fecha: new Date(data.fecha),
      createdBy: userId,
    });

    return normalizeValorJus(valor);
  }

  static async update(id: number, estudioId: number, data: UpdateValorJusInput) {
    const updateData: Parameters<typeof ValorJusQueries.updateValorJus>[2] = {};
    if (data.valor !== undefined) updateData.valor = data.valor.toFixed(4);
    if (data.fecha !== undefined) updateData.fecha = new Date(data.fecha);
    if (data.activo !== undefined) updateData.activo = data.activo;

    const valor = await ValorJusQueries.updateValorJus(id, estudioId, updateData);
    if (!valor) throw new Error("VALOR_JUS_NOT_FOUND");

    return normalizeValorJus(valor);
  }

  static async delete(id: number, estudioId: number) {
    const deleted = await ValorJusQueries.deleteValorJus(id, estudioId);
    if (!deleted) throw new Error("VALOR_JUS_NOT_FOUND");
  }

  static async getValorJusSnapshot(fecha: Date, estudioId: number) {
    const valor = await ValorJusQueries.findValorJusByFecha(fecha, estudioId);
    return valor ? Number(valor.valor) : null;
  }
}

function normalizeValorJus<T extends { valor: string } | null>(valor: T) {
  if (!valor) return null;
  return serializeDates({
    ...valor,
    valor: Number(valor.valor),
  });
}
