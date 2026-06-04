import type { FastifyReply, FastifyRequest } from "fastify";
import { SearchService } from "../services/search.service.js";
import { serializeDates } from "../utils/serialize.js";

export class SearchController {
  static async query(request: FastifyRequest<{ Querystring: { q?: string } }>, reply: FastifyReply) {
    const q = request.query.q?.trim() ?? "";
    const result = await SearchService.globalSearch(request.authUser.estudioId, q);
    return reply.send({ data: serializeDates(result) });
  }
}
