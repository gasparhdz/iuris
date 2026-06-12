import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { EventosController } from "../controllers/eventos.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import { methodNotAllowed } from "../utils/method-not-allowed.js";
import {
  createEventoSchema, updateEventoSchema,
  eventoQuerySchema, idParamSchema,
  eventoResponseSchema, eventoListResponseSchema
} from "../schemas/eventos.schema.js";

export const eventosRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };
  const can = (accion: "ver" | "crear" | "editar" | "eliminar") => ({
    preHandler: [fastify.authenticate, fastify.authorize("EVENTOS", accion)],
  });

  server.get("/", {
    ...can("ver"),
    schema: {
      tags: ["Eventos"],
      summary: "Listar eventos",
      security: [{ bearerAuth: [] }],
      querystring: eventoQuerySchema,
      response: documentedResponses(200, eventoListResponseSchema),
    }
  }, EventosController.findAll);

  server.get("/:id", {
    ...can("ver"),
    schema: {
      tags: ["Eventos"],
      summary: "Obtener un evento por ID",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, eventoResponseSchema),
    }
  }, EventosController.findById);

  server.post("/", {
    ...can("crear"),
    schema: {
      tags: ["Eventos"],
      summary: "Crear un nuevo evento",
      security: [{ bearerAuth: [] }],
      body: createEventoSchema,
      response: documentedResponses(201, eventoResponseSchema),
    }
  }, EventosController.create);

  server.put("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);
  server.patch("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);
  server.delete("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);

  server.put("/:id", {
    ...can("editar"),
    schema: {
      tags: ["Eventos"],
      summary: "Actualizar un evento",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: updateEventoSchema,
      response: documentedResponses(200, eventoResponseSchema),
    }
  }, EventosController.update);

  server.delete("/:id", {
    ...can("eliminar"),
    schema: {
      tags: ["Eventos"],
      summary: "Eliminar un evento",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    }
  }, EventosController.softDelete);
};
