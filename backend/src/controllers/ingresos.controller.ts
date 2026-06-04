import type { FastifyReply, FastifyRequest } from "fastify";
import { IngresosService } from "../services/ingresos.service.js";
import type { IngresoQueryInput, UpdateIngresoInput } from "../schemas/ingresos.schema.js";

export class IngresosController {
  static async findAll(request: FastifyRequest<{ Querystring: IngresoQueryInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    const result = await IngresosService.findAll(auth.estudioId, request.query);
    return reply.send(result);
  }

  static async update(request: FastifyRequest<{ Params: { id: number }; Body: UpdateIngresoInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const ingreso = await IngresosService.update(request.params.id, auth.estudioId, auth.userId, request.body);
      return reply.send({ data: ingreso });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }

  static async delete(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      await IngresosService.delete(request.params.id, auth.estudioId, auth.userId);
      return reply.send({ data: { message: "Ingreso eliminado" } });
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
    INGRESO_NOT_FOUND: "Ingreso no encontrado",
    CUOTA_NOT_FOUND: "Cuota no encontrada",
  };

  const message = errors[error.message];
  if (message) return reply.status(404).send({ error: { code: "NOT_FOUND", message } });

  throw error;
}
