import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { DriveController } from "../controllers/drive.controller.js";
import { documentedResponses } from "../schemas/common.schema.js";
import { driveFolderResponseSchema, driveIdParamSchema, vincularCarpetaSchema } from "../schemas/drive.schema.js";

export const driveRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  // Las carpetas de Drive son parte de la gestion documental (modulo ADJUNTOS).
  const can = (accion: "ver" | "crear" | "editar" | "eliminar") => ({
    preHandler: [fastify.authenticate, fastify.authorize("ADJUNTOS", accion)],
  });

  server.post("/clientes/:id/create", {
    ...can("crear"),
    schema: {
      tags: ["Drive"],
      summary: "Crear carpeta Drive de cliente",
      security: [{ bearerAuth: [] }],
      params: driveIdParamSchema,
      response: documentedResponses(200, driveFolderResponseSchema),
    },
  }, DriveController.crearCarpetaCliente);

  server.post("/expedientes/:id/create", {
    ...can("crear"),
    schema: {
      tags: ["Drive"],
      summary: "Crear carpeta Drive de expediente",
      security: [{ bearerAuth: [] }],
      params: driveIdParamSchema,
      response: documentedResponses(200, driveFolderResponseSchema),
    },
  }, DriveController.crearCarpetaCaso);

  server.put("/clientes/:id/vincular", {
    ...can("editar"),
    schema: {
      tags: ["Drive"],
      summary: "Vincular carpeta Drive de cliente",
      security: [{ bearerAuth: [] }],
      params: driveIdParamSchema,
      body: vincularCarpetaSchema,
      response: documentedResponses(200, driveFolderResponseSchema),
    },
  }, DriveController.vincularCarpetaCliente);

  server.put("/expedientes/:id/vincular", {
    ...can("editar"),
    schema: {
      tags: ["Drive"],
      summary: "Vincular carpeta Drive de expediente",
      security: [{ bearerAuth: [] }],
      params: driveIdParamSchema,
      body: vincularCarpetaSchema,
      response: documentedResponses(200, driveFolderResponseSchema),
    },
  }, DriveController.vincularCarpetaCaso);
};
