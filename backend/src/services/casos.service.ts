import { CasosQueries } from "../db/queries/casos.queries.js";
import { serializeDates } from "../utils/serialize.js";
import type { CreateCasoInput, UpdateCasoInput, AddParticipanteInput } from "../schemas/casos.schema.js";
import { AuditoriaService, calcDiff } from "./auditoria.service.js";
import { SoftDeleteService } from "./soft-delete.service.js";

export class CasosService {
  static async findAll(estudioId: number, page: number = 1, limit: number = 20, search?: string) {
    const offset = (page - 1) * limit;
    const { data, count } = await CasosQueries.findAll(estudioId, limit, offset, search);

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
    const nroExpteNorm = data.nroExpte
      ? data.nroExpte.replace(/[\s-]/g, "").toUpperCase()
      : null;

    if (nroExpteNorm) {
      const duplicate = await CasosQueries.findByNroExpteNorm(estudioId, nroExpteNorm);
      if (duplicate) throw new Error("CASO_DUPLICATE_NRO_EXPTE");
    }

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

    const updateData: Parameters<typeof CasosQueries.update>[2] = { ...data, updatedAt: new Date(), updatedBy: userId };
    if (data.nroExpte) {
      updateData.nroExpteNorm = data.nroExpte.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
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
    const participante = await CasosQueries.insertParticipante({ casoId, estudioId, ...data });
    return serializeDates(participante);
  }

  static async getParticipantes(casoId: number, estudioId: number) {
    await this.findById(casoId, estudioId);
    const data = await CasosQueries.findParticipantes(casoId, estudioId);
    return serializeDates(data);
  }

  static async removeParticipante(participanteId: number, casoId: number, estudioId: number) {
    await this.findById(casoId, estudioId);
    const deleted = await CasosQueries.deleteParticipante(participanteId, casoId, estudioId);
    if (!deleted) throw new Error("PARTICIPANTE_NOT_FOUND");
  }

  static async updateParticipante(participanteId: number, casoId: number, estudioId: number, data: Partial<AddParticipanteInput>) {
    await this.findById(casoId, estudioId);
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
}
