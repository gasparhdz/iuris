import type { FastifyReply, FastifyRequest } from "fastify";
import { TercerosService } from "../services/terceros.service.js";
import type { CreateTerceroInput, UpdateTerceroInput } from "../schemas/terceros.schema.js";

export class TercerosController {
  static async findAll(request: FastifyRequest<{ Querystring: { page?: number; limit?: number; search?: string } }>, reply: FastifyReply) {
    try {
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 20;
      const result = await TercerosService.findAll(request.authUser.estudioId, page, limit, request.query.search);
      return reply.send(result);
    } catch (error) {
      throw error;
    }
  }

  static async findById(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      const tercero = await TercerosService.findById(request.params.id, request.authUser.estudioId);
      return reply.send({ data: tercero });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "TERCERO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Tercero no encontrado" } });
      }
      throw error;
    }
  }

  static async create(request: FastifyRequest<{ Body: CreateTerceroInput }>, reply: FastifyReply) {
    try {
      const tercero = await TercerosService.create(request.authUser.estudioId, request.authUser.id, request.body);
      return reply.status(201).send({ data: tercero });
    } catch (error) {
      throw error;
    }
  }

  static async update(request: FastifyRequest<{ Params: { id: number }; Body: UpdateTerceroInput }>, reply: FastifyReply) {
    try {
      const tercero = await TercerosService.update(request.params.id, request.authUser.estudioId, request.authUser.id, request.body);
      return reply.send({ data: tercero });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "TERCERO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Tercero no encontrado" } });
      }
      throw error;
    }
  }

  static async delete(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      await TercerosService.delete(request.params.id, request.authUser.estudioId, request.authUser.id);
      return reply.send({ data: { message: "Tercero eliminado" } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "TERCERO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Tercero no encontrado" } });
      }
      throw error;
    }
  }
}
