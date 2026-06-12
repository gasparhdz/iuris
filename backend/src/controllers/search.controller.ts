import type { FastifyReply, FastifyRequest } from "fastify";
import { SearchService } from "../services/search.service.js";
import { AuthQueries } from "../db/queries/auth.queries.js";
import { hasPermiso } from "../auth/permissions.js";
import { serializeDates } from "../utils/serialize.js";

export class SearchController {
  static async query(request: FastifyRequest<{ Querystring: { q?: string } }>, reply: FastifyReply) {
    const q = request.query.q?.trim() ?? "";

    // El buscador es transversal: gateamos cada sección por el permiso `ver` del módulo,
    // para no filtrar datos de módulos que el usuario no puede ver (OWASP A01).
    const permisos = request.permisosCache ?? await AuthQueries.findUserPermisos(request.authUser.id);
    request.permisosCache = permisos;
    const puedeVer = (modulo: string) => hasPermiso(permisos, modulo, "ver");

    const result = await SearchService.globalSearch(request.authUser.estudioId, q, {
      casos: puedeVer("CASOS"),
      clientes: puedeVer("CLIENTES"),
      terceros: puedeVer("TERCEROS"),
      tareas: puedeVer("TAREAS"),
      eventos: puedeVer("EVENTOS"),
    });
    return reply.send({ data: serializeDates(result) });
  }
}
