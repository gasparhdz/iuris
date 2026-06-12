import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { NotasController } from "../controllers/notas.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import {
  casoNotasParamsSchema,
  clienteNotasParamsSchema,
  createNotaSchema,
  notaParamsSchema,
  notaResponseSchema,
  notasListResponseSchema,
} from "../schemas/notas.schema.js";

export const notasRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const can = (accion: "ver" | "crear" | "editar" | "eliminar") => ({
    preHandler: [fastify.authenticate, fastify.authorize("NOTAS", accion)],
  });

  server.get("/clientes/:clienteId/notas", {
    ...can("ver"),
    schema: {
      tags: ["Notas"],
      summary: "Listar notas de un cliente",
      security: [{ bearerAuth: [] }],
      params: clienteNotasParamsSchema,
      response: documentedResponses(200, notasListResponseSchema),
    },
  }, NotasController.findByCliente);

  server.post("/clientes/:clienteId/notas", {
    ...can("crear"),
    schema: {
      tags: ["Notas"],
      summary: "Agregar nota a un cliente",
      security: [{ bearerAuth: [] }],
      params: clienteNotasParamsSchema,
      body: createNotaSchema,
      response: documentedResponses(201, notaResponseSchema),
    },
  }, NotasController.createCliente);

  server.delete("/clientes/notas/:id", {
    ...can("eliminar"),
    schema: {
      tags: ["Notas"],
      summary: "Eliminar nota de cliente",
      security: [{ bearerAuth: [] }],
      params: notaParamsSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, NotasController.deleteCliente);

  server.get("/expedientes/:casoId/notas", {
    ...can("ver"),
    schema: {
      tags: ["Notas"],
      summary: "Listar notas de un expediente",
      security: [{ bearerAuth: [] }],
      params: casoNotasParamsSchema,
      response: documentedResponses(200, notasListResponseSchema),
    },
  }, NotasController.findByCaso);

  server.post("/expedientes/:casoId/notas", {
    ...can("crear"),
    schema: {
      tags: ["Notas"],
      summary: "Agregar nota a un expediente",
      security: [{ bearerAuth: [] }],
      params: casoNotasParamsSchema,
      body: createNotaSchema,
      response: documentedResponses(201, notaResponseSchema),
    },
  }, NotasController.createCaso);

  server.delete("/expedientes/notas/:id", {
    ...can("eliminar"),
    schema: {
      tags: ["Notas"],
      summary: "Eliminar nota de expediente",
      security: [{ bearerAuth: [] }],
      params: notaParamsSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, NotasController.deleteCaso);
};
