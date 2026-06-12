import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { TercerosController } from "../controllers/terceros.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import { methodNotAllowed } from "../utils/method-not-allowed.js";
import {
  createTerceroSchema, updateTerceroSchema,
  terceroQuerySchema, idParamSchema,
  terceroResponseSchema, terceroListResponseSchema,
} from "../schemas/terceros.schema.js";

export const tercerosRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };
  const can = (accion: "ver" | "crear" | "editar" | "eliminar") => ({
    preHandler: [fastify.authenticate, fastify.authorize("TERCEROS", accion)],
  });

  server.get("/", {
    ...can("ver"),
    schema: {
      tags: ["Terceros"],
      summary: "Listar terceros del estudio (Paginado)",
      security: [{ bearerAuth: [] }],
      querystring: terceroQuerySchema,
      response: documentedResponses(200, terceroListResponseSchema),
    },
  }, TercerosController.findAll);

  server.get("/:id", {
    ...can("ver"),
    schema: {
      tags: ["Terceros"],
      summary: "Obtener un tercero por ID",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, terceroResponseSchema),
    },
  }, TercerosController.findById);

  server.post("/", {
    ...can("crear"),
    schema: {
      tags: ["Terceros"],
      summary: "Crear un nuevo tercero",
      security: [{ bearerAuth: [] }],
      body: createTerceroSchema,
      response: documentedResponses(201, terceroResponseSchema),
    },
  }, TercerosController.create);

  server.put("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);
  server.patch("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);
  server.delete("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);

  server.put("/:id", {
    ...can("editar"),
    schema: {
      tags: ["Terceros"],
      summary: "Actualizar un tercero existente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: updateTerceroSchema,
      response: documentedResponses(200, terceroResponseSchema),
    },
  }, TercerosController.update);

  server.delete("/:id", {
    ...can("eliminar"),
    schema: {
      tags: ["Terceros"],
      summary: "Eliminar un tercero (Físico)",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, TercerosController.delete);
};
