import type { FastifyPluginAsync } from "fastify";
import { AuthQueries } from "../db/queries/auth.queries.js";
import { registrarConexion } from "../sse/sse.registry.js";
import { consumeSseTicket, issueSseTicket } from "../services/sse-ticket.service.js";

/**
 * Canal de notificaciones en tiempo real vía Server-Sent Events.
 *
 * EventSource no permite headers personalizados. En lugar del access JWT en
 * querystring, el cliente pide un ticket efímero (POST /ticket) y lo usa una
 * sola vez en GET /stream?token=<ticket>.
 */
export const sseRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/ticket", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const issued = await issueSseTicket({
        usuarioId: request.authUser.id,
        estudioId: request.authUser.estudioId,
        tokenVersion: request.authUser.tokenVersion,
      });
      return reply.send({ data: issued });
    } catch {
      return reply.status(503).send({
        error: { code: "SSE_TICKET_UNAVAILABLE", message: "No se pudo emitir ticket SSE" },
      });
    }
  });

  fastify.get("/stream", async (request, reply) => {
    const token = (request.query as { token?: string } | undefined)?.token;
    if (!token) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Falta token" } });
    }

    // Solo tickets SSE efímeros: un access JWT normal no está en el store → 401.
    const ticketPayload = await consumeSseTicket(token);
    if (!ticketPayload) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Ticket SSE invalido o expirado" } });
    }

    const authData = await AuthQueries.findUserAuthData(ticketPayload.usuarioId);
    if (
      !authData?.activo
      || authData.tokenVersion !== ticketPayload.tokenVersion
      || authData.estudioId !== ticketPayload.estudioId
    ) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
    }
    if (!authData.estudioActivo) {
      return reply.status(403).send({ error: { code: "ESTUDIO_SUSPENDIDO", message: "El estudio se encuentra suspendido" } });
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.write("retry: 5000\n\n");

    registrarConexion(authData.id, reply);

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(": ping\n\n");
      } catch {
        clearInterval(heartbeat);
      }
    }, 25_000);

    reply.raw.on("close", () => clearInterval(heartbeat));

    return reply;
  });
};
