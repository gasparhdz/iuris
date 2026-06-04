import type { FastifyReply, FastifyRequest } from "fastify";
import { CatalogosQueries } from "../db/queries/catalogos.queries.js";
import type { LocalidadQuery, ParametroQuery } from "../schemas/catalogos.schema.js";

export class CatalogosController {
  static async provincias(_request: FastifyRequest, reply: FastifyReply) {
    const rows = await CatalogosQueries.findProvincias();
    return reply.send({ data: rows });
  }

  static async localidades(request: FastifyRequest<{ Querystring: LocalidadQuery }>, reply: FastifyReply) {
    const rows = await CatalogosQueries.findLocalidades(request.query.provinciaId);
    return reply.send({ data: rows });
  }

  static async parametros(request: FastifyRequest<{ Querystring: ParametroQuery }>, reply: FastifyReply) {
    const rows = await CatalogosQueries.findParametros(request.query.categoria);
    return reply.send({ data: rows });
  }
}
