import type { FastifyReply, FastifyRequest } from "fastify";
import { EventosService } from "../services/eventos.service.js";
import type { CreateEventoInput, EventoQueryInput, UpdateEventoInput } from "../schemas/eventos.schema.js";

export class EventosController {
  static async findAll(request: FastifyRequest<{ Querystring: EventoQueryInput }>, reply: FastifyReply) {
    try {
      const result = await EventosService.findAll(request.authUser.estudioId, request.query);
      return reply.send(result);
    } catch (error) {
      throw error;
    }
  }

  static async findById(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      const evento = await EventosService.findById(request.params.id, request.authUser.estudioId);
      return reply.send({ data: evento });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "EVENTO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Evento no encontrado" } });
      }
      throw error;
    }
  }

  static async create(request: FastifyRequest<{ Body: CreateEventoInput }>, reply: FastifyReply) {
    try {
      const evento = await EventosService.create(request.authUser.estudioId, request.authUser.id, request.body);
      return reply.status(201).send({ data: evento });
    } catch (error) {
      throw error;
    }
  }

  static async update(request: FastifyRequest<{ Params: { id: number }; Body: UpdateEventoInput }>, reply: FastifyReply) {
    try {
      const evento = await EventosService.update(request.params.id, request.authUser.estudioId, request.authUser.id, request.body);
      return reply.send({ data: evento });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "EVENTO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Evento no encontrado" } });
      }
      throw error;
    }
  }

  static async softDelete(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      await EventosService.softDelete(request.params.id, request.authUser.estudioId, request.authUser.id);
      return reply.send({ data: { message: "Evento eliminado" } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "EVENTO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Evento no encontrado" } });
      }
      throw error;
    }
  }
}
