import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AuditoriaController } from "../controllers/auditoria.controller.js";

export const auditoriaRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };

  server.get("/", {
    ...authConfig,
    schema: {
      tags: ["Auditoría"],
      summary: "Listar logs de auditoría",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        entidad: z.string().optional(),
        entidadId: z.coerce.number().optional(),
        usuarioId: z.coerce.number().optional(),
        desde: z.string().optional(),
        hasta: z.string().optional(),
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(50),
      }),
    },
  }, AuditoriaController.findAll);

  server.get("/expediente/:id", {
    ...authConfig,
    schema: {
      tags: ["Auditoría"],
      summary: "Historial de auditoría por expediente",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.coerce.number() }),
    },
  }, AuditoriaController.findByExpediente);
};
