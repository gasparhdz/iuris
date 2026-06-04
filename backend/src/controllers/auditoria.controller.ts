import type { FastifyReply, FastifyRequest } from "fastify";
import { AuditoriaQueries } from "../db/queries/auditoria.queries.js";
import { serializeDates } from "../utils/serialize.js";

export class AuditoriaController {
  static async findAll(
    request: FastifyRequest<{
      Querystring: {
        entidad?: string;
        entidadId?: number;
        usuarioId?: number;
        desde?: string;
        hasta?: string;
        page?: number;
        limit?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    const { entidad, entidadId, usuarioId, desde, hasta, page = 1, limit = 50 } = request.query;
    const { estudioId } = request.authUser;
    const safeLimit = Math.min(Number(limit), 200);

    const { data, count } = await AuditoriaQueries.findAll(estudioId, {
      entidad,
      entidadId,
      usuarioId,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
      page: Number(page),
      limit: safeLimit,
    });

    const items = data.map(({ log, usuarioNombre }) => ({
      ...serializeDates(log),
      usuarioNombre: usuarioNombre || "Sistema",
    }));

    return reply.send({
      data: {
        items,
        meta: { total: count, page: Number(page), limit: safeLimit },
      },
    });
  }

  static async findByExpediente(
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const { estudioId } = request.authUser;
    const data = await AuditoriaQueries.findByExpediente(estudioId, id);
    const items = data.map(({ log, usuarioNombre }) => ({
      ...serializeDates(log),
      usuarioNombre: usuarioNombre || "Sistema",
    }));

    return reply.send({ data: items });
  }
}
