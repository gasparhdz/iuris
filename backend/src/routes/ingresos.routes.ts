import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { IngresosController } from "../controllers/ingresos.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import {
  idParamSchema,
  ingresoListResponseSchema,
  ingresoQuerySchema,
  ingresoResponseSchema,
  updateIngresoSchema,
} from "../schemas/ingresos.schema.js";

export const ingresosRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };

  server.get("/", {
    ...authConfig,
    schema: {
      tags: ["Ingresos"],
      summary: "Listar ingresos",
      security: [{ bearerAuth: [] }],
      querystring: ingresoQuerySchema,
      response: documentedResponses(200, ingresoListResponseSchema),
    },
  }, IngresosController.findAll);

  server.put("/:id", {
    ...authConfig,
    schema: {
      tags: ["Ingresos"],
      summary: "Modificar ingreso",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: updateIngresoSchema,
      response: documentedResponses(200, ingresoResponseSchema),
    },
  }, IngresosController.update);

  server.delete("/:id", {
    ...authConfig,
    schema: {
      tags: ["Ingresos"],
      summary: "Eliminar ingreso",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, IngresosController.delete);
};
