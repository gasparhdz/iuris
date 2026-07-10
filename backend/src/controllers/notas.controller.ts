import type { FastifyReply, FastifyRequest } from "fastify";
import { NotasService } from "../services/notas.service.js";
import type { CreateNotaInput } from "../schemas/notas.schema.js";

export class NotasController {
  static async findByCliente(request: FastifyRequest<{ Params: { clienteId: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const notas = await NotasService.findNotasByCliente(request.params.clienteId, auth.estudioId);
      return reply.send({ data: notas });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CLIENTE_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
      }
      throw error;
    }
  }

  static async createCliente(request: FastifyRequest<{ Params: { clienteId: number }; Body: CreateNotaInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const nota = await NotasService.createNotaCliente(request.params.clienteId, auth.estudioId, auth.userId, request.body);
      return reply.status(201).send({ data: nota });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CLIENTE_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
      }
      throw error;
    }
  }

  static async deleteCliente(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      await NotasService.deleteNotaCliente(request.params.id, auth.estudioId);
      return reply.send({ data: { message: "Nota eliminada" } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "NOTA_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Nota no encontrada" } });
      }
      throw error;
    }
  }

  static async findByCaso(request: FastifyRequest<{ Params: { casoId: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const notas = await NotasService.findNotasByCaso(request.params.casoId, auth.estudioId);
      return reply.send({ data: notas });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CASO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Expediente no encontrado" } });
      }
      throw error;
    }
  }

  static async createCaso(request: FastifyRequest<{ Params: { casoId: number }; Body: CreateNotaInput }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      const nota = await NotasService.createNotaCaso(request.params.casoId, auth.estudioId, auth.userId, request.body);
      return reply.status(201).send({ data: nota });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CASO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Expediente no encontrado" } });
      }
      throw error;
    }
  }

  static async deleteCaso(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const auth = getAuthContext(request, reply);
    if (!auth) return;

    try {
      await NotasService.deleteNotaCaso(request.params.id, auth.estudioId);
      return reply.send({ data: { message: "Nota eliminada" } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "NOTA_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Nota no encontrada" } });
      }
      if (error instanceof Error && error.message === "CASO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Expediente no encontrado" } });
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
