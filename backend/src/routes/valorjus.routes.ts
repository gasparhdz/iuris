import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ValorJusController } from "../controllers/valorjus.controller.js";
import { isSuperRole, forbidden } from "../controllers/admin.controller.js";
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
  const canRead = {
    preHandler: [fastify.authenticate, fastify.authorize("VALORJUS", "ver")],
  };
  // Mutaciones tocan el registro GLOBAL (estudioId=1): solo admin de plataforma.
  const canMutate = {
    preHandler: [
      fastify.authenticate,
      async (request: Parameters<typeof isSuperRole>[0], reply: Parameters<typeof forbidden>[0]) => {
        if (!isSuperRole(request)) return forbidden(reply);
      },
    ],
  };

  server.get("/actual", {
    ...canRead,
    schema: {
      tags: ["Valor JUS"],
      summary: "Obtener valor JUS actual",
      security: [{ bearerAuth: [] }],
      querystring: valorJusActualQuerySchema,
      response: documentedResponses(200, valorJusNullableResponseSchema),
    },
  }, ValorJusController.findActual);

  server.get("/historico", {
    ...canRead,
    schema: {
      tags: ["Valor JUS"],
      summary: "Obtener valor JUS historico por fecha",
      security: [{ bearerAuth: [] }],
      querystring: valorJusActualQuerySchema,
      response: documentedResponses(200, valorJusNullableResponseSchema),
    },
  }, ValorJusController.findActual);

  server.get("/", {
    ...canRead,
    schema: {
      tags: ["Valor JUS"],
      summary: "Listar historico de valores JUS",
      security: [{ bearerAuth: [] }],
      querystring: valorJusQuerySchema,
      response: documentedResponses(200, valorJusListResponseSchema),
    },
  }, ValorJusController.findAll);

  server.post("/", {
    ...canMutate,
    schema: {
      tags: ["Valor JUS"],
      summary: "Crear valor JUS",
      security: [{ bearerAuth: [] }],
      body: createValorJusSchema,
      response: documentedResponses(201, valorJusResponseSchema),
    },
  }, ValorJusController.create);

  // El sync solo trae valores del portal oficial (no acepta datos del usuario):
  // alcanza con el permiso de creación del módulo, no requiere admin de plataforma.
  const canSync = {
    preHandler: [fastify.authenticate, fastify.authorize("VALORJUS", "crear")],
  };

  server.post("/sync", {
    ...canSync,
    schema: {
      tags: ["Valor JUS"],
      summary: "Sincronizar valores JUS desde el portal oficial",
      security: [{ bearerAuth: [] }],
      response: documentedResponses(200, valorJusSyncResponseSchema),
    },
  }, ValorJusController.sync);

  server.put("/:id", {
    ...canMutate,
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
    ...canMutate,
    schema: {
      tags: ["Valor JUS"],
      summary: "Eliminar valor JUS",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, ValorJusController.delete);
};
