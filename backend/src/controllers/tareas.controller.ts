import type { FastifyReply, FastifyRequest } from "fastify";
import { TareasService } from "../services/tareas.service.js";
import type { CreateTareaInput, UpdateTareaInput } from "../schemas/tareas.schema.js";

export class TareasController {
  static async findAll(request: FastifyRequest<{ Querystring: { completada?: string; asignadoA?: number; page?: number; limit?: number } }>, reply: FastifyReply) {
    try {
      const { completada, asignadoA, page, limit } = request.query;
      const result = await TareasService.findAll(request.authUser.estudioId, {
        completada: completada === "true" ? true : completada === "false" ? false : undefined,
        asignadoA,
        page: page ?? 1,
        limit: limit ?? 50,
      });
      return reply.send(result);
    } catch (error) {
      throw error;
    }
  }

  static async findById(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      const result = await TareasService.findById(request.params.id, request.authUser.estudioId);
      return reply.send({ data: result });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "TAREA_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Tarea no encontrada" } });
      }
      throw error;
    }
  }

  static async create(request: FastifyRequest<{ Body: CreateTareaInput }>, reply: FastifyReply) {
    try {
      const result = await TareasService.create(request.authUser.estudioId, request.authUser.id, request.body);
      return reply.status(201).send({ data: result });
    } catch (error) {
      throw error;
    }
  }

  static async update(request: FastifyRequest<{ Params: { id: number }; Body: UpdateTareaInput }>, reply: FastifyReply) {
    try {
      const result = await TareasService.update(request.params.id, request.authUser.estudioId, request.authUser.id, request.body);
      return reply.send({ data: result });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "TAREA_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Tarea no encontrada" } });
      }
      throw error;
    }
  }

  static async softDelete(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      await TareasService.softDelete(request.params.id, request.authUser.estudioId, request.authUser.id);
      return reply.send({ data: { message: "Tarea eliminada" } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "TAREA_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Tarea no encontrada" } });
      }
      throw error;
    }
  }

  static async addSubtarea(request: FastifyRequest<{ Params: { id: number }; Body: { titulo: string; orden?: number } }>, reply: FastifyReply) {
    try {
      const result = await TareasService.addSubtarea(request.params.id, request.authUser.estudioId, request.body);
      return reply.status(201).send({ data: result });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "TAREA_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Tarea no encontrada" } });
      }
      throw error;
    }
  }

  static async toggleSubtarea(request: FastifyRequest<{ Params: { id: number; subtareaId: number } }>, reply: FastifyReply) {
    try {
      const result = await TareasService.toggleSubtarea(request.params.subtareaId, request.params.id, request.authUser.estudioId);
      return reply.send({ data: result });
    } catch (error: unknown) {
      if (error instanceof Error && (error.message === "TAREA_NOT_FOUND" || error.message === "SUBTAREA_NOT_FOUND")) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "No encontrado" } });
      }
      throw error;
    }
  }

  static async updateSubtarea(request: FastifyRequest<{ Params: { id: number; subtareaId: number }; Body: { titulo?: string; orden?: number } }>, reply: FastifyReply) {
    try {
      const result = await TareasService.updateSubtarea(request.params.subtareaId, request.params.id, request.authUser.estudioId, request.body);
      return reply.send({ data: result });
    } catch (error: unknown) {
      if (error instanceof Error && (error.message === "TAREA_NOT_FOUND" || error.message === "SUBTAREA_NOT_FOUND")) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "No encontrado" } });
      }
      throw error;
    }
  }

  static async deleteSubtarea(request: FastifyRequest<{ Params: { id: number; subtareaId: number } }>, reply: FastifyReply) {
    try {
      await TareasService.deleteSubtarea(request.params.subtareaId, request.params.id, request.authUser.estudioId);
      return reply.send({ data: { message: "Subtarea eliminada" } });
    } catch (error: unknown) {
      if (error instanceof Error && (error.message === "TAREA_NOT_FOUND" || error.message === "SUBTAREA_NOT_FOUND")) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "No encontrado" } });
      }
      throw error;
    }
  }
}
