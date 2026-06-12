import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { GastosController } from "../controllers/gastos.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import {
  createGastoSchema,
  gastoListResponseSchema,
  gastoQuerySchema,
  gastoResponseSchema,
  idParamSchema,
  updateGastoSchema,
} from "../schemas/gastos.schema.js";

export const gastosRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const can = (accion: "ver" | "crear" | "editar" | "eliminar") => ({
    preHandler: [fastify.authenticate, fastify.authorize("GASTOS", accion)],
  });

  server.get("/", {
    ...can("ver"),
    schema: {
      tags: ["Gastos"],
      summary: "Listar gastos",
      security: [{ bearerAuth: [] }],
      querystring: gastoQuerySchema,
      response: documentedResponses(200, gastoListResponseSchema),
    },
  }, GastosController.findAll);

  server.post("/", {
    ...can("crear"),
    schema: {
      tags: ["Gastos"],
      summary: "Registrar gasto",
      security: [{ bearerAuth: [] }],
      body: createGastoSchema,
      response: documentedResponses(201, gastoResponseSchema),
    },
  }, GastosController.create);

  server.put("/:id", {
    ...can("editar"),
    schema: {
      tags: ["Gastos"],
      summary: "Modificar gasto",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: updateGastoSchema,
      response: documentedResponses(200, gastoResponseSchema),
    },
  }, GastosController.update);

  server.delete("/:id", {
    ...can("eliminar"),
    schema: {
      tags: ["Gastos"],
      summary: "Eliminar gasto",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, GastosController.delete);
};
