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
  const can = (accion: "ver" | "crear" | "editar" | "eliminar") => ({
    preHandler: [fastify.authenticate, fastify.authorize("PLANTILLAS", accion)],
  });

  server.get("/plantillas", {
    ...can("ver"),
    schema: {
      tags: ["Plantillas"],
      summary: "Listar plantillas",
      security: [{ bearerAuth: [] }],
      response: documentedResponses(200, plantillaListResponseSchema),
    },
  }, PlantillasController.findAll);

  server.post("/plantillas", {
    ...can("crear"),
    schema: {
      tags: ["Plantillas"],
      summary: "Crear plantilla",
      security: [{ bearerAuth: [] }],
      body: createPlantillaSchema,
      response: documentedResponses(201, plantillaResponseSchema),
    },
  }, PlantillasController.create);

  server.put("/plantillas/:id", {
    ...can("editar"),
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
    ...can("eliminar"),
    schema: {
      tags: ["Plantillas"],
      summary: "Eliminar plantilla",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, PlantillasController.delete);

  server.post("/expedientes/:casoId/generar", {
    ...can("ver"),
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
