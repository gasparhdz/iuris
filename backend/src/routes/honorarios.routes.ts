import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { HonorariosController } from "../controllers/honorarios.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import {
  createHonorarioSchema,
  honorarioListResponseSchema,
  honorarioQuerySchema,
  honorarioResponseSchema,
  idParamSchema,
  updateHonorarioSchema,
} from "../schemas/honorarios.schema.js";

export const honorariosRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const can = (accion: "ver" | "crear" | "editar" | "eliminar") => ({
    preHandler: [fastify.authenticate, fastify.authorize("HONORARIOS", accion)],
  });

  server.get("/", {
    ...can("ver"),
    schema: {
      tags: ["Honorarios"],
      summary: "Listar honorarios",
      security: [{ bearerAuth: [] }],
      querystring: honorarioQuerySchema,
      response: documentedResponses(200, honorarioListResponseSchema),
    },
  }, HonorariosController.findAll);

  server.get("/:id", {
    ...can("ver"),
    schema: {
      tags: ["Honorarios"],
      summary: "Obtener honorario",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, honorarioResponseSchema),
    },
  }, HonorariosController.findById);

  server.post("/", {
    ...can("crear"),
    schema: {
      tags: ["Honorarios"],
      summary: "Crear honorario",
      security: [{ bearerAuth: [] }],
      body: createHonorarioSchema,
      response: documentedResponses(201, honorarioResponseSchema),
    },
  }, HonorariosController.create);

  server.put("/:id", {
    ...can("editar"),
    schema: {
      tags: ["Honorarios"],
      summary: "Actualizar honorario",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: updateHonorarioSchema,
      response: documentedResponses(200, honorarioResponseSchema),
    },
  }, HonorariosController.update);

  server.delete("/:id", {
    ...can("eliminar"),
    schema: {
      tags: ["Honorarios"],
      summary: "Eliminar honorario",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, HonorariosController.delete);
};
