import type { FastifyReply, FastifyRequest } from "fastify";
import { AgendaService } from "../services/agenda.service.js";
import { AuthQueries } from "../db/queries/auth.queries.js";

export class AgendaController {
  static async getOverview(request: FastifyRequest<{ Querystring: { from: string; to: string } }>, reply: FastifyReply) {
    try {
      const { from, to } = request.query;
      if (!from || !to) {
        return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Debe proporcionar rango de fechas (from, to)" } });
      }

      const permisos = await AuthQueries.findUserPermisos(request.authUser.id);
      const data = await AgendaService.getOverview(request.authUser.estudioId, from, to, {
        verEventos: permisos.some((p) => p.modulo === "EVENTOS" && p.ver),
        verTareas: permisos.some((p) => p.modulo === "TAREAS" && p.ver),
      });
      return reply.send({ data });
    } catch (error) {
      throw error;
    }
  }
}
