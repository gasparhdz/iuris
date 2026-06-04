import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { DriveController } from "../controllers/drive.controller.js";
import { documentedResponses } from "../schemas/common.schema.js";
import { driveFolderResponseSchema, driveIdParamSchema, vincularCarpetaSchema } from "../schemas/drive.schema.js";

export const driveRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };

  server.post("/clientes/:id/create", {
    ...authConfig,
    schema: {
      tags: ["Drive"],
      summary: "Crear carpeta Drive de cliente",
      security: [{ bearerAuth: [] }],
      params: driveIdParamSchema,
      response: documentedResponses(200, driveFolderResponseSchema),
    },
  }, DriveController.crearCarpetaCliente);

  server.post("/expedientes/:id/create", {
    ...authConfig,
    schema: {
      tags: ["Drive"],
      summary: "Crear carpeta Drive de expediente",
      security: [{ bearerAuth: [] }],
      params: driveIdParamSchema,
      response: documentedResponses(200, driveFolderResponseSchema),
    },
  }, DriveController.crearCarpetaCaso);

  server.put("/clientes/:id/vincular", {
    ...authConfig,
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
    ...authConfig,
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
