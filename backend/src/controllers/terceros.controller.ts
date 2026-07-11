import type { FastifyReply, FastifyRequest } from "fastify";
import { TercerosService } from "../services/terceros.service.js";
import { CuentaCorrienteService } from "../services/cuenta-corriente.service.js";
import type { CreateTerceroInput, TerceroListQuery, UpdateTerceroInput } from "../schemas/terceros.schema.js";

export class TercerosController {
  static async findAll(request: FastifyRequest<{ Querystring: TerceroListQuery }>, reply: FastifyReply) {
    try {
      const result = await TercerosService.findAll(request.authUser.estudioId, request.query);
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

  static async findCuentaCorriente(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      const cuenta = await CuentaCorrienteService.getCuentaCorrienteTercero(
        request.params.id,
        request.authUser.estudioId,
      );
      return reply.send({ data: cuenta });
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
      if (error instanceof Error && error.message === "TERCERO_HAS_ACTIVE_PARTICIPACIONES") {
        return reply.status(409).send({
          error: {
            code: "CONFLICT",
            message: "No se puede eliminar: el tercero participa en expedientes",
          },
        });
      }
      throw error;
    }
  }
}
