import type { FastifyPluginAsync } from "fastify";
import { AuthQueries } from "../db/queries/auth.queries.js";
import { registrarConexion } from "../sse/sse.registry.js";
import type { JwtPayload } from "../plugins/auth.plugin.js";

/**
 * Canal de notificaciones en tiempo real vía Server-Sent Events.
 *
 * EventSource (navegador) no permite enviar headers personalizados, por lo que
 * el access token viaja como query param `?token=...` y se valida manualmente
 * con la misma lógica que el plugin de auth (jwtVerify + tokenVersion + estudio).
 */
export const sseRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/stream", async (request, reply) => {
    const token = (request.query as { token?: string } | undefined)?.token;
    if (!token) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Falta token" } });
    }

    let payload: JwtPayload;
    try {
      payload = fastify.jwt.verify<JwtPayload>(token);
    } catch {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Token invalido o expirado" } });
    }

    if (!payload.id || !payload.estudioId) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Sesion invalida" } });
    }

    const authData = await AuthQueries.findUserAuthData(payload.id);
    if (
      !authData?.activo ||
      authData.tokenVersion !== payload.tokenVersion ||
      authData.estudioId !== payload.estudioId
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

    // Heartbeat para evitar que proxies cierren la conexión por inactividad.
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(": ping\n\n");
      } catch {
        clearInterval(heartbeat);
      }
    }, 25_000);

    reply.raw.on("close", () => clearInterval(heartbeat));

    // Mantenemos la conexión abierta: no resolvemos con un body.
    return reply;
  });
};
