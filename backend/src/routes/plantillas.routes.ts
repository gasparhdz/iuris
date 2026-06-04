import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { PlantillasController } from "../controllers/plantillas.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import {
  createPlantillaSchema,
  generarDocumentoParamsSchema,
  generarDocumentoResponseSchema,
  generarDocumentoSchema,
  idParamSchema,
  plantillaListResponseSchema,
  plantillaResponseSchema,
  updatePlantillaSchema,
} from "../schemas/plantillas.schema.js";

export const plantillasRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };

  server.get("/plantillas", {
    ...authConfig,
    schema: {
      tags: ["Plantillas"],
      summary: "Listar plantillas",
      security: [{ bearerAuth: [] }],
      response: documentedResponses(200, plantillaListResponseSchema),
    },
  }, PlantillasController.findAll);

  server.post("/plantillas", {
    ...authConfig,
    schema: {
      tags: ["Plantillas"],
      summary: "Crear plantilla",
      security: [{ bearerAuth: [] }],
      body: createPlantillaSchema,
      response: documentedResponses(201, plantillaResponseSchema),
    },
  }, PlantillasController.create);

  server.put("/plantillas/:id", {
    ...authConfig,
    schema: {
      tags: ["Plantillas"],
      summary: "Actualizar plantilla",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: updatePlantillaSchema,
      response: documentedResponses(200, plantillaResponseSchema),
    },
  }, PlantillasController.update);

  server.delete("/plantillas/:id", {
    ...authConfig,
    schema: {
      tags: ["Plantillas"],
      summary: "Eliminar plantilla",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, PlantillasController.delete);

  server.post("/expedientes/:casoId/generar", {
    ...authConfig,
    schema: {
      tags: ["Documentos"],
      summary: "Generar documento desde plantilla",
      security: [{ bearerAuth: [] }],
      params: generarDocumentoParamsSchema,
      body: generarDocumentoSchema,
      response: documentedResponses(200, generarDocumentoResponseSchema),
    },
  }, PlantillasController.generarDocumento);
};
