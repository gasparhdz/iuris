import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { MovimientosController } from "../controllers/movimientos.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import {
  casoMovimientosParamsSchema,
  createMovimientoSchema,
  movimientoParamsSchema,
  movimientoResponseSchema,
  movimientosListResponseSchema,
  updateMovimientoSchema,
} from "../schemas/movimientos.schema.js";

export const movimientosRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };

  server.get("/expedientes/:casoId/movimientos", {
    ...authConfig,
    schema: {
      tags: ["Movimientos Judiciales"],
      summary: "Listar movimientos judiciales de un expediente",
      security: [{ bearerAuth: [] }],
      params: casoMovimientosParamsSchema,
      response: documentedResponses(200, movimientosListResponseSchema),
    },
  }, MovimientosController.findByCaso);

  server.post("/expedientes/:casoId/movimientos", {
    ...authConfig,
    schema: {
      tags: ["Movimientos Judiciales"],
      summary: "Agregar movimiento judicial a un expediente",
      security: [{ bearerAuth: [] }],
      params: casoMovimientosParamsSchema,
      body: createMovimientoSchema,
      response: documentedResponses(201, movimientoResponseSchema),
    },
  }, MovimientosController.create);

  server.put("/movimientos/:id", {
    ...authConfig,
    schema: {
      tags: ["Movimientos Judiciales"],
      summary: "Editar movimiento judicial",
      security: [{ bearerAuth: [] }],
      params: movimientoParamsSchema,
      body: updateMovimientoSchema,
      response: documentedResponses(200, movimientoResponseSchema),
    },
  }, MovimientosController.update);

  server.delete("/movimientos/:id", {
    ...authConfig,
    schema: {
      tags: ["Movimientos Judiciales"],
      summary: "Eliminar movimiento judicial",
      security: [{ bearerAuth: [] }],
      params: movimientoParamsSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, MovimientosController.delete);
};
