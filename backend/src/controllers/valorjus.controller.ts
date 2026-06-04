import type { FastifyReply, FastifyRequest } from "fastify";
import { ValorJusService } from "../services/valorjus.service.js";
import { ValorJusScraperService } from "../services/valorjus-scraper.service.js";
import type { CreateValorJusInput, UpdateValorJusInput, ValorJusQueryInput } from "../schemas/valorjus.schema.js";

export class ValorJusController {
  static async findActual(request: FastifyRequest<{ Querystring: { fecha?: string } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    const fecha = request.query.fecha ? new Date(request.query.fecha) : undefined;
    const valor = await ValorJusService.findActual(auth.estudioId, fecha);
    return reply.send({ data: valor });
  }

  static async findAll(request: FastifyRequest<{ Querystring: ValorJusQueryInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    const result = await ValorJusService.findAll(auth.estudioId, request.query);
    return reply.send(result);
  }

  static async create(request: FastifyRequest<{ Body: CreateValorJusInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    const valor = await ValorJusService.create(auth.estudioId, auth.userId, request.body);
    return reply.status(201).send({ data: valor });
  }

  static async sync(request: FastifyRequest, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    const result = await ValorJusScraperService.sync();

    return reply.send({
      data: {
        message: result.message,
        insertedCount: result.insertedCount,
        maxFechaActual: result.maxFechaActual,
        parsedCount: result.parsedCount,
        items: result.data,
      },
    });
  }

  static async update(request: FastifyRequest<{ Params: { id: number }; Body: UpdateValorJusInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const valor = await ValorJusService.update(request.params.id, auth.estudioId, request.body);
      return reply.send({ data: valor });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "VALOR_JUS_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Valor JUS no encontrado" } });
      }
      throw error;
    }
  }

  static async delete(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      await ValorJusService.delete(request.params.id, auth.estudioId);
      return reply.send({ data: { message: "Valor JUS eliminado" } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "VALOR_JUS_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Valor JUS no encontrado" } });
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
