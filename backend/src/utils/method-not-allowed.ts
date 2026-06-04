import type { FastifyReply, FastifyRequest } from "fastify";

export function methodNotAllowed(_request: FastifyRequest, reply: FastifyReply) {
  return reply.status(405).send({
    error: {
      code: "METHOD_NOT_ALLOWED",
      message: "Metodo no soportado para esta ruta",
    },
  });
}
