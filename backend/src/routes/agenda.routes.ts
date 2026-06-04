import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { AgendaController } from "../controllers/agenda.controller.js";
import { documentedResponses } from "../schemas/common.schema.js";
import { agendaQuerySchema, agendaResponseSchema } from "../schemas/agenda.schema.js";

export const agendaRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };

  server.get("/", {
    ...authConfig,
    schema: {
      tags: ["Agenda"],
      summary: "Vista unificada de Agenda (Eventos y Tareas)",
      security: [{ bearerAuth: [] }],
      querystring: agendaQuerySchema,
      response: documentedResponses(200, agendaResponseSchema),
    }
  }, AgendaController.getOverview);
};
