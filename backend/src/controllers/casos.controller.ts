import type { FastifyReply, FastifyRequest } from "fastify";
import { CasosService } from "../services/casos.service.js";
import type { AddParticipanteInput, CreateCasoInput, UpdateCasoInput } from "../schemas/casos.schema.js";

export class CasosController {
  static async findAll(request: FastifyRequest<{ Querystring: { page?: number; limit?: number; search?: string } }>, reply: FastifyReply) {
    try {
      const { page, limit, search } = request.query;
      const result = await CasosService.findAll(request.authUser.estudioId, page ?? 1, limit ?? 20, search);
      return reply.send(result);
    } catch (error) {
      throw error;
    }
  }

  static async findById(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      const caso = await CasosService.findById(request.params.id, request.authUser.estudioId);
      return reply.send({ data: caso });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CASO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Expediente no encontrado" } });
      }
      if (error instanceof Error && error.message === "CASO_HAS_LIVE_INGRESOS") {
        return reply.status(409).send({ error: { code: "CONFLICT", message: "No se puede eliminar un expediente con ingresos activos" } });
      }
      throw error;
    }
  }

  static async create(request: FastifyRequest<{ Body: CreateCasoInput }>, reply: FastifyReply) {
    try {
      const caso = await CasosService.create(request.authUser.estudioId, request.authUser.id, request.body);
      return reply.status(201).send({ data: caso });
    } catch (error) {
      throw error;
    }
  }

  static async update(request: FastifyRequest<{ Params: { id: number }; Body: UpdateCasoInput }>, reply: FastifyReply) {
    try {
      const caso = await CasosService.update(request.params.id, request.authUser.estudioId, request.authUser.id, request.body);
      return reply.send({ data: caso });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CASO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Expediente no encontrado" } });
      }
      throw error;
    }
  }

  static async softDelete(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      await CasosService.softDelete(request.params.id, request.authUser.estudioId, request.authUser.id);
      return reply.send({ data: { message: "Expediente eliminado" } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CASO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Expediente no encontrado" } });
      }
      throw error;
    }
  }

  static async addParticipante(request: FastifyRequest<{ Params: { id: number }; Body: AddParticipanteInput }>, reply: FastifyReply) {
    try {
      const participante = await CasosService.addParticipante(request.params.id, request.authUser.estudioId, request.body);
      return reply.status(201).send({ data: participante });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CASO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Expediente no encontrado" } });
      }
      throw error;
    }
  }

  static async getParticipantes(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      const data = await CasosService.getParticipantes(request.params.id, request.authUser.estudioId);
      return reply.send({ data });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CASO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Expediente no encontrado" } });
      }
      throw error;
    }
  }

  static async removeParticipante(request: FastifyRequest<{ Params: { id: number; participanteId: number } }>, reply: FastifyReply) {
    try {
      await CasosService.removeParticipante(request.params.participanteId, request.params.id, request.authUser.estudioId);
      return reply.send({ data: { message: "Participante eliminado" } });
    } catch (error: unknown) {
      if (error instanceof Error && (error.message === "CASO_NOT_FOUND" || error.message === "PARTICIPANTE_NOT_FOUND")) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "No encontrado" } });
      }
      throw error;
    }
  }

  static async updateParticipante(request: FastifyRequest<{ Params: { id: number; participanteId: number }; Body: Partial<AddParticipanteInput> }>, reply: FastifyReply) {
    try {
      const participante = await CasosService.updateParticipante(request.params.participanteId, request.params.id, request.authUser.estudioId, request.body);
      return reply.send({ data: participante });
    } catch (error: unknown) {
      if (error instanceof Error && (error.message === "CASO_NOT_FOUND" || error.message === "PARTICIPANTE_NOT_FOUND")) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "No encontrado" } });
      }
      throw error;
    }
  }

  static async getTareas(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      const data = await CasosService.getTareas(request.params.id, request.authUser.estudioId);
      return reply.send({ data });
    } catch (error) {
      throw error;
    }
  }

  static async getEventos(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      const data = await CasosService.getEventos(request.params.id, request.authUser.estudioId);
      return reply.send({ data });
    } catch (error) {
      throw error;
    }
  }
}
