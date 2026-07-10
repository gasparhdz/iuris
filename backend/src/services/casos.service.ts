import { CasosQueries } from "../db/queries/casos.queries.js";
import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { TercerosQueries } from "../db/queries/terceros.queries.js";
import { serializeDates } from "../utils/serialize.js";
import type { CreateCasoInput, AddParticipanteInput } from "../schemas/casos.schema.js";
import { AuditoriaService, calcDiff } from "./auditoria.service.js";
import { SoftDeleteService } from "./soft-delete.service.js";

import type { CasoQueryInput } from "../schemas/casos.schema.js";

export class CasosService {
  static async findAll(estudioId: number, query: CasoQueryInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const { data, count } = await CasosQueries.findAll(estudioId, limit, offset, {
      search: query.search,
      estadoId: query.estadoId,
      ramaId: query.ramaId,
      radicacionParentId: query.radicacionParentId,
      orderBy: query.orderBy,
      order: query.order,
    });

    return {
      data: {
        items: serializeDates(data),
        meta: { total: count, page, limit },
      },
    };
  }

  static async findById(id: number, estudioId: number) {
    const caso = await CasosQueries.findById(id, estudioId);
    if (!caso) throw new Error("CASO_NOT_FOUND");
    return serializeDates(caso);
  }

  static async create(estudioId: number, userId: number, data: CreateCasoInput) {
    await this.ensureClienteVivo(data.clienteId, estudioId);

    const nroExpteNorm = data.nroExpte
      ? data.nroExpte.replace(/[\s-]/g, "").toUpperCase()
      : null;

    if (nroExpteNorm) {
      const duplicate = await CasosQueries.findByNroExpteNorm(estudioId, nroExpteNorm);
      if (duplicate) throw new Error("CASO_DUPLICATE_NRO_EXPTE");
    }

    // TODO: endpoint transaccional expediente+participantes (alta atómica).
    const caso = await CasosQueries.insert({ ...data, estudioId, createdBy: userId, nroExpteNorm });
    await AuditoriaService.log({
      estudioId,
      usuarioId: userId,
      entidad: "caso",
      entidadId: caso.id,
      accion: "CREATE",
      descripcion: `Expediente creado: ${caso.caratula || caso.nroExpte || caso.id}`,
    });
    return serializeDates(caso);
  }

  static async update(id: number, estudioId: number, userId: number, data: Partial<CreateCasoInput>) {
    const before = await this.findById(id, estudioId);

    if (data.clienteId !== undefined) {
      await this.ensureClienteVivo(data.clienteId, estudioId);
    }

    // Solo campos presentes (incl. null explícito). undefined no se toca — evita borrar
    // radicacionId/estadoRadicacionId cargados por SISFE cuando el form no los envía.
    const updateData: Parameters<typeof CasosQueries.update>[2] = { updatedAt: new Date(), updatedBy: userId };
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (updateData as Record<string, unknown>)[key] = value;
      }
    }
    if (data.nroExpte !== undefined) {
      updateData.nroExpteNorm = data.nroExpte
        ? data.nroExpte.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
        : null;
    }

    const caso = await CasosQueries.update(id, estudioId, updateData);
    const diff = calcDiff(before as Record<string, unknown>, serializeDates(caso) as Record<string, unknown>);
    if (diff) {
      await AuditoriaService.log({
        estudioId,
        usuarioId: userId,
        entidad: "caso",
        entidadId: id,
        accion: diff.after.estadoId !== undefined ? "ESTADO_CHANGED" : "UPDATE",
        descripcion: diff.after.estadoId !== undefined ? "Estado del expediente cambiado" : "Expediente actualizado",
        cambios: diff,
      });
    }
    return serializeDates(caso);
  }

  static async softDelete(id: number, estudioId: number, userId: number) {
    await SoftDeleteService.softDeleteCaso(id, estudioId, userId);
  }

  // --- Participantes ---

  static async addParticipante(casoId: number, estudioId: number, data: AddParticipanteInput) {
    await this.findById(casoId, estudioId);
    const tercero = await TercerosQueries.findById(data.terceroId, estudioId);
    if (!tercero) throw new Error("TERCERO_NOT_FOUND");
    const participante = await CasosQueries.insertParticipante({ casoId, estudioId, ...data });
    return serializeDates(participante);
  }

  static async getParticipantes(casoId: number, estudioId: number) {
    await this.findById(casoId, estudioId);
    const data = await CasosQueries.findParticipantes(casoId, estudioId);
    return serializeDates(data);
  }

  static async getParticipantesElegibles(casoId: number, estudioId: number) {
    const data = await CasosQueries.findParticipantesElegibles(casoId, estudioId);
    if (!data) throw new Error("CASO_NOT_FOUND");
    return data;
  }

  static async removeParticipante(participanteId: number, casoId: number, estudioId: number) {
    await this.findById(casoId, estudioId);
    const deleted = await CasosQueries.deleteParticipante(participanteId, casoId, estudioId);
    if (!deleted) throw new Error("PARTICIPANTE_NOT_FOUND");
  }

  static async updateParticipante(participanteId: number, casoId: number, estudioId: number, data: Partial<AddParticipanteInput>) {
    await this.findById(casoId, estudioId);
    if (data.terceroId !== undefined) {
      const tercero = await TercerosQueries.findById(data.terceroId, estudioId);
      if (!tercero) throw new Error("TERCERO_NOT_FOUND");
    }
    const updated = await CasosQueries.updateParticipante(participanteId, casoId, estudioId, data);
    if (!updated) throw new Error("PARTICIPANTE_NOT_FOUND");
    return serializeDates(updated);
  }

  static async getTareas(casoId: number, estudioId: number) {
    await this.findById(casoId, estudioId);
    const data = await CasosQueries.findTareasByCaso(casoId, estudioId);
    return serializeDates(data);
  }

  static async getEventos(casoId: number, estudioId: number) {
    await this.findById(casoId, estudioId);
    const data = await CasosQueries.findEventosByCaso(casoId, estudioId);
    return serializeDates(data);
  }

  private static async ensureClienteVivo(clienteId: number, estudioId: number) {
    const cliente = await ClientesQueries.findById(clienteId, estudioId);
    if (!cliente) throw new Error("CLIENTE_NOT_FOUND");
  }
}
