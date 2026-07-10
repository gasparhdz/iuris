import type { FastifyReply, FastifyRequest } from "fastify";
import { HonorariosService } from "../services/honorarios.service.js";
import type { CreateHonorarioInput, HonorarioQueryInput, UpdateHonorarioInput } from "../schemas/honorarios.schema.js";

export class HonorariosController {
  static async findAll(request: FastifyRequest<{ Querystring: HonorarioQueryInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    const result = await HonorariosService.findAll(auth.estudioId, request.query);
    return reply.send(result);
  }

  static async findById(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const honorario = await HonorariosService.findById(request.params.id, auth.estudioId);
      return reply.send({ data: honorario });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "HONORARIO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Honorario no encontrado" } });
      }
      throw error;
    }
  }

  static async create(request: FastifyRequest<{ Body: CreateHonorarioInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const honorario = await HonorariosService.create(auth.estudioId, auth.userId, request.body);
      return reply.status(201).send({ data: honorario });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }

  static async update(request: FastifyRequest<{ Params: { id: number }; Body: UpdateHonorarioInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const honorario = await HonorariosService.update(request.params.id, auth.estudioId, auth.userId, request.body);
      return reply.send({ data: honorario });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }

  static async delete(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      await HonorariosService.delete(request.params.id, auth.estudioId, auth.userId);
      return reply.send({ data: { message: "Honorario eliminado" } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "HONORARIO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Honorario no encontrado" } });
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

function handleKnownError(error: unknown, reply: FastifyReply) {
  if (!(error instanceof Error)) throw error;

  if (error.message === "HONORARIO_NOT_FOUND") {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Honorario no encontrado" } });
  }

  if (error.message === "CLIENTE_NOT_FOUND") {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
  }

  if (error.message === "CASO_NOT_FOUND") {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Expediente no encontrado" } });
  }

  if (error.message === "OBLIGADO_REQUIRED") {
    return reply.status(400).send({ error: { code: "INVALID_INPUT", message: "Debe indicar el obligado al pago" } });
  }

  if (error.message === "OBLIGADO_INVALID") {
    return reply.status(400).send({ error: { code: "INVALID_INPUT", message: "Solo puede indicar un obligado al pago (cliente o tercero)" } });
  }

  if (error.message === "OBLIGADO_NOT_FOUND") {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Obligado al pago no encontrado" } });
  }

  if (error.message === "OBLIGADO_NOT_IN_CASO") {
    return reply.status(400).send({ error: { code: "INVALID_INPUT", message: "El obligado al pago no pertenece al expediente o cliente indicado" } });
  }

  if (error.message === "OBLIGADO_REQUIRES_CASO") {
    return reply.status(400).send({ error: { code: "INVALID_INPUT", message: "Un tercero solo puede ser obligado si hay expediente" } });
  }

  throw error;
}
