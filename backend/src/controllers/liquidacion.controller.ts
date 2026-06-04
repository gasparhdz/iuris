import type { FastifyReply, FastifyRequest } from "fastify";
import { LiquidacionService } from "../services/liquidacion.service.js";

export class LiquidacionController {
  static async getLiquidacionCaso(request: FastifyRequest<{ Params: { casoId: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const liquidacion = await LiquidacionService.getLiquidacionCaso(request.params.casoId, auth.estudioId);
      return reply.send({ data: liquidacion });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }

  static async getLiquidacionCliente(request: FastifyRequest<{ Params: { clienteId: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const liquidacion = await LiquidacionService.getLiquidacionCliente(request.params.clienteId, auth.estudioId);
      return reply.send({ data: liquidacion });
    } catch (error: unknown) {
      return handleKnownError(error, reply);
    }
  }
}

function getAuthContext(request: FastifyRequest, reply: FastifyReply): { estudioId: number } | null {
  if (!request.user.estudioId) {
    reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
    return null;
  }

  return { estudioId: request.user.estudioId };
}

function handleKnownError(error: unknown, reply: FastifyReply) {
  if (!(error instanceof Error)) throw error;

  if (error.message === "CASO_NOT_FOUND") {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Expediente no encontrado" } });
  }

  if (error.message === "CLIENTE_NOT_FOUND") {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
  }

  throw error;
}
