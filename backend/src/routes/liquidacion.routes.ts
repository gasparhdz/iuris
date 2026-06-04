import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { LiquidacionController } from "../controllers/liquidacion.controller.js";
import {
  casoLiquidacionParamsSchema,
  clienteLiquidacionParamsSchema,
  liquidacionResponseSchema,
} from "../schemas/liquidacion.schema.js";
import { documentedResponses } from "../schemas/common.schema.js";

export const liquidacionRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };

  server.get("/expedientes/:casoId/liquidacion", {
    ...authConfig,
    schema: {
      tags: ["Liquidaciones"],
      summary: "Obtener liquidacion de expediente",
      security: [{ bearerAuth: [] }],
      params: casoLiquidacionParamsSchema,
      response: documentedResponses(200, liquidacionResponseSchema),
    },
  }, LiquidacionController.getLiquidacionCaso);

  server.get("/clientes/:clienteId/liquidacion", {
    ...authConfig,
    schema: {
      tags: ["Liquidaciones"],
      summary: "Obtener liquidacion de cliente",
      security: [{ bearerAuth: [] }],
      params: clienteLiquidacionParamsSchema,
      response: documentedResponses(200, liquidacionResponseSchema),
    },
  }, LiquidacionController.getLiquidacionCliente);
};
