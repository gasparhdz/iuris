import type { FastifyReply, FastifyRequest } from "fastify";
import { GastosService } from "../services/gastos.service.js";
import type { CreateGastoInput, GastoQueryInput, UpdateGastoInput } from "../schemas/gastos.schema.js";

export class GastosController {
  static async findAll(request: FastifyRequest<{ Querystring: GastoQueryInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    const result = await GastosService.findAll(auth.estudioId, request.query);
    return reply.send(result);
  }

  static async create(request: FastifyRequest<{ Body: CreateGastoInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const gasto = await GastosService.create(auth.estudioId, auth.userId, request.body);
      return reply.status(201).send({ data: gasto });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }

  static async update(request: FastifyRequest<{ Params: { id: number }; Body: UpdateGastoInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const gasto = await GastosService.update(request.params.id, auth.estudioId, auth.userId, request.body);
      return reply.send({ data: gasto });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }

  static async delete(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      await GastosService.delete(request.params.id, auth.estudioId, auth.userId);
      return reply.send({ data: { message: "Gasto eliminado" } });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }
}

function getAuthContext(request: FastifyRequest, reply: FastifyReply): { estudioId: number; userId: number } | null {
  if (!request.user.estudioId) {
    reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
    return null;
  }

  return { estudioId: request.user.estudioId, userId: request.authUser.id };
}

function handleKnownError(error: unknown, reply: FastifyReply) {
  if (!(error instanceof Error)) throw error;

  const errors: Record<string, string> = {
    GASTO_NOT_FOUND: "Gasto no encontrado",
    CLIENTE_NOT_FOUND: "Cliente no encontrado",
    CASO_NOT_FOUND: "Expediente no encontrado",
  };

  const message = errors[error.message];
  if (message) return reply.status(404).send({ error: { code: "NOT_FOUND", message } });

  throw error;
}
