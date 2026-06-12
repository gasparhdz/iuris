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
  // La liquidación consolida honorarios + gastos + ingresos: es un reporte financiero.
  // Se exige `ver` sobre HONORARIOS para no exponer el panorama financiero a roles que
  // solo pueden ver expedientes/clientes (OWASP A01). Antes solo pedía estar autenticado.
  const authConfig = { preHandler: [fastify.authenticate, fastify.authorize("HONORARIOS", "ver")] };

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
