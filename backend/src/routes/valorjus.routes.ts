import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ValorJusController } from "../controllers/valorjus.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import {
  createValorJusSchema,
  idParamSchema,
  updateValorJusSchema,
  valorJusListResponseSchema,
  valorJusNullableResponseSchema,
  valorJusQuerySchema,
  valorJusResponseSchema,
  valorJusSyncResponseSchema,
  valorJusActualQuerySchema,
} from "../schemas/valorjus.schema.js";

export const valorJusRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };

  server.get("/actual", {
    ...authConfig,
    schema: {
      tags: ["Valor JUS"],
      summary: "Obtener valor JUS actual",
      security: [{ bearerAuth: [] }],
      querystring: valorJusActualQuerySchema,
      response: documentedResponses(200, valorJusNullableResponseSchema),
    },
  }, ValorJusController.findActual);

  server.get("/historico", {
    ...authConfig,
    schema: {
      tags: ["Valor JUS"],
      summary: "Obtener valor JUS historico por fecha",
      security: [{ bearerAuth: [] }],
      querystring: valorJusActualQuerySchema,
      response: documentedResponses(200, valorJusNullableResponseSchema),
    },
  }, ValorJusController.findActual);

  server.get("/", {
    ...authConfig,
    schema: {
      tags: ["Valor JUS"],
      summary: "Listar historico de valores JUS",
      security: [{ bearerAuth: [] }],
      querystring: valorJusQuerySchema,
      response: documentedResponses(200, valorJusListResponseSchema),
    },
  }, ValorJusController.findAll);

  server.post("/", {
    ...authConfig,
    schema: {
      tags: ["Valor JUS"],
      summary: "Crear valor JUS",
      security: [{ bearerAuth: [] }],
      body: createValorJusSchema,
      response: documentedResponses(201, valorJusResponseSchema),
    },
  }, ValorJusController.create);

  server.post("/sync", {
    ...authConfig,
    schema: {
      tags: ["Valor JUS"],
      summary: "Sincronizar valores JUS desde el portal oficial",
      security: [{ bearerAuth: [] }],
      response: documentedResponses(200, valorJusSyncResponseSchema),
    },
  }, ValorJusController.sync);

  server.put("/:id", {
    ...authConfig,
    schema: {
      tags: ["Valor JUS"],
      summary: "Actualizar valor JUS",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: updateValorJusSchema,
      response: documentedResponses(200, valorJusResponseSchema),
    },
  }, ValorJusController.update);

  server.delete("/:id", {
    ...authConfig,
    schema: {
      tags: ["Valor JUS"],
      summary: "Eliminar valor JUS",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, ValorJusController.delete);
};
