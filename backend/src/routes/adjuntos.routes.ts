import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { AdjuntosController } from "../controllers/adjuntos.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import {
  adjuntoListResponseSchema,
  adjuntoResponseSchema,
  adjuntosQuerySchema,
  confirmAdjuntoSchema,
  idParamSchema,
  indexarAdjuntosResponseSchema,
  presignAdjuntoResponseSchema,
  presignAdjuntoSchema,
  uploadAdjuntoSchema,
} from "../schemas/adjuntos.schema.js";

export const adjuntosRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const can = (accion: "ver" | "crear" | "editar" | "eliminar") => ({
    preHandler: [fastify.authenticate, fastify.authorize("ADJUNTOS", accion)],
  });

  server.post("/upload", {
    ...can("crear"),
    schema: {
      tags: ["Adjuntos"],
      summary: "Subir adjunto",
      security: [{ bearerAuth: [] }],
      querystring: uploadAdjuntoSchema,
      response: documentedResponses(201, adjuntoResponseSchema),
    },
  }, AdjuntosController.upload);

  server.post("/presign", {
    ...can("crear"),
    schema: {
      tags: ["Adjuntos"],
      summary: "Crear URL firmada para subida directa",
      security: [{ bearerAuth: [] }],
      body: presignAdjuntoSchema,
      response: documentedResponses(200, presignAdjuntoResponseSchema),
    },
  }, AdjuntosController.presign);

  server.post("/confirm", {
    ...can("crear"),
    schema: {
      tags: ["Adjuntos"],
      summary: "Confirmar adjunto subido directo",
      security: [{ bearerAuth: [] }],
      body: confirmAdjuntoSchema,
      response: documentedResponses(201, adjuntoResponseSchema),
    },
  }, AdjuntosController.confirm);

  server.get("/", {
    ...can("ver"),
    schema: {
      tags: ["Adjuntos"],
      summary: "Listar adjuntos",
      security: [{ bearerAuth: [] }],
      querystring: adjuntosQuerySchema,
      response: documentedResponses(200, adjuntoListResponseSchema),
    },
  }, AdjuntosController.findAll);

  server.get("/indexar", {
    ...can("crear"),
    schema: {
      tags: ["Adjuntos"],
      summary: "Indexar adjuntos desde Drive",
      security: [{ bearerAuth: [] }],
      querystring: adjuntosQuerySchema,
      response: documentedResponses(200, indexarAdjuntosResponseSchema),
    },
  }, AdjuntosController.indexar);

  server.delete("/:id", {
    ...can("eliminar"),
    schema: {
      tags: ["Adjuntos"],
      summary: "Eliminar adjunto",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, AdjuntosController.delete);
};
