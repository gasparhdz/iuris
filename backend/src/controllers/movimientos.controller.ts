import type { FastifyReply, FastifyRequest } from "fastify";
import { MovimientosService } from "../services/movimientos.service.js";
import type { CreateMovimientoInput, UpdateMovimientoInput } from "../schemas/movimientos.schema.js";

export class MovimientosController {
  static async findByCaso(request: FastifyRequest<{ Params: { casoId: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const movimientos = await MovimientosService.findMovimientosByCaso(request.params.casoId, auth.estudioId);
      return reply.send({ data: movimientos });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CASO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Expediente no encontrado" } });
      }
      throw error;
    }
  }

  static async create(request: FastifyRequest<{ Params: { casoId: number }; Body: CreateMovimientoInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const movimiento = await MovimientosService.create(request.params.casoId, auth.estudioId, auth.userId, request.body);
      return reply.status(201).send({ data: movimiento });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CASO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Expediente no encontrado" } });
      }
      throw error;
    }
  }

  static async update(request: FastifyRequest<{ Params: { id: number }; Body: UpdateMovimientoInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const movimiento = await MovimientosService.update(request.params.id, auth.estudioId, request.body);
      return reply.send({ data: movimiento });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "MOVIMIENTO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Movimiento no encontrado" } });
      }
      throw error;
    }
  }

  static async delete(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      await MovimientosService.delete(request.params.id, auth.estudioId);
      return reply.send({ data: { message: "Movimiento eliminado" } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "MOVIMIENTO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Movimiento no encontrado" } });
      }
      throw error;
    }
  }
}

function getAuthContext(request: FastifyRequest, reply: FastifyReply): { estudioId: number; userId: number } | null {
  if (!request.user.estudioId) {
    reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
    return null;
  }

  return { estudioId: request.user.estudioId, userId: request.user.id };
}
