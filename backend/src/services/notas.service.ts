import { CasosQueries } from "../db/queries/casos.queries.js";
import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { NotasQueries } from "../db/queries/notas.queries.js";
import { serializeDates } from "../utils/serialize.js";
import type { CreateNotaInput } from "../schemas/notas.schema.js";

export class NotasService {
  static async findNotasByCliente(clienteId: number, estudioId: number) {
    await this.ensureCliente(clienteId, estudioId);
    const notas = await NotasQueries.findNotasByCliente(clienteId, estudioId);
    return serializeDates(notas);
  }

  static async findNotasByCaso(casoId: number, estudioId: number) {
    await this.ensureCaso(casoId, estudioId);
    const notas = await NotasQueries.findNotasByCaso(casoId, estudioId);
    return serializeDates(notas);
  }

  static async createNotaCliente(clienteId: number, estudioId: number, userId: number, data: CreateNotaInput) {
    await this.ensureCliente(clienteId, estudioId);
    const nota = await NotasQueries.insertNotaCliente({
      clienteId,
      contenido: data.contenido,
      createdBy: userId,
    }, estudioId);

    return serializeDates(nota);
  }

  static async createNotaCaso(casoId: number, estudioId: number, userId: number, data: CreateNotaInput) {
    await this.ensureCaso(casoId, estudioId);
    const nota = await NotasQueries.insertNotaCaso({
      casoId,
      contenido: data.contenido,
      createdBy: userId,
    }, estudioId);

    return serializeDates(nota);
  }

  static async deleteNotaCliente(id: number, estudioId: number) {
    const deleted = await NotasQueries.deleteNotaCliente(id, estudioId);
    if (!deleted) throw new Error("NOTA_NOT_FOUND");
  }

  static async deleteNotaCaso(id: number, estudioId: number) {
    const nota = await NotasQueries.findNotaCasoById(id, estudioId);
    if (!nota) throw new Error("NOTA_NOT_FOUND");
    await this.ensureCaso(nota.casoId, estudioId);
    const deleted = await NotasQueries.deleteNotaCaso(id, estudioId);
    if (!deleted) throw new Error("NOTA_NOT_FOUND");
  }

  private static async ensureCliente(clienteId: number, estudioId: number) {
    const cliente = await ClientesQueries.findById(clienteId, estudioId);
    if (!cliente) throw new Error("CLIENTE_NOT_FOUND");
  }

  private static async ensureCaso(casoId: number, estudioId: number) {
    const caso = await CasosQueries.findById(casoId, estudioId);
    if (!caso) throw new Error("CASO_NOT_FOUND");
  }
}
