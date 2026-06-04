import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CasosController } from "../controllers/casos.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import { methodNotAllowed } from "../utils/method-not-allowed.js";
import { 
  createCasoSchema, updateCasoSchema, addParticipanteSchema,
  casoQuerySchema, idParamSchema, participanteParamsSchema,
  casoResponseSchema, casoListResponseSchema,
  participanteResponseSchema, participanteListResponseSchema,
  casoTareasListResponseSchema, casoEventosListResponseSchema
} from "../schemas/casos.schema.js";

export const expedientesRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };

  server.get("/", {
    ...authConfig,
    schema: {
      tags: ["Expedientes"],
      summary: "Listar expedientes",
      security: [{ bearerAuth: [] }],
      querystring: casoQuerySchema,
      response: documentedResponses(200, casoListResponseSchema),
    }
  }, CasosController.findAll);

  server.get("/:id", {
    ...authConfig,
    schema: {
      tags: ["Expedientes"],
      summary: "Obtener un expediente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, casoResponseSchema),
    }
  }, CasosController.findById);

  server.post("/", {
    ...authConfig,
    schema: {
      tags: ["Expedientes"],
      summary: "Crear un nuevo expediente",
      security: [{ bearerAuth: [] }],
      body: createCasoSchema,
      response: documentedResponses(201, casoResponseSchema),
    }
  }, CasosController.create);

  server.put("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);
  server.patch("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);
  server.delete("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);

  server.put("/:id", {
    ...authConfig,
    schema: {
      tags: ["Expedientes"],
      summary: "Actualizar un expediente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: updateCasoSchema,
      response: documentedResponses(200, casoResponseSchema),
    }
  }, CasosController.update);

  server.delete("/:id", {
    ...authConfig,
    schema: {
      tags: ["Expedientes"],
      summary: "Eliminar un expediente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    }
  }, CasosController.softDelete);

  // --- Participantes ---

  server.post("/:id/participantes", {
    ...authConfig,
    schema: {
      tags: ["Expedientes - Participantes"],
      summary: "Sumar participante al expediente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: addParticipanteSchema,
      response: documentedResponses(201, participanteResponseSchema),
    }
  }, CasosController.addParticipante);

  server.get("/:id/participantes", {
    ...authConfig,
    schema: {
      tags: ["Expedientes - Participantes"],
      summary: "Ver participantes del expediente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, participanteListResponseSchema),
    }
  }, CasosController.getParticipantes);

  server.delete("/:id/participantes/:participanteId", {
    ...authConfig,
    schema: {
      tags: ["Expedientes - Participantes"],
      summary: "Quitar participante",
      security: [{ bearerAuth: [] }],
      params: participanteParamsSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    }
  }, CasosController.removeParticipante);

  server.put("/:id/participantes/:participanteId", {
    ...authConfig,
    schema: {
      tags: ["Expedientes - Participantes"],
      summary: "Actualizar participante",
      security: [{ bearerAuth: [] }],
      params: participanteParamsSchema,
      body: addParticipanteSchema.partial(),
      response: documentedResponses(200, participanteResponseSchema),
    }
  }, CasosController.updateParticipante);

  server.get("/:id/tareas", {
    ...authConfig,
    schema: {
      tags: ["Expedientes - Tareas"],
      summary: "Ver tareas del expediente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, casoTareasListResponseSchema),
    }
  }, CasosController.getTareas);

  server.get("/:id/eventos", {
    ...authConfig,
    schema: {
      tags: ["Expedientes - Eventos"],
      summary: "Ver eventos del expediente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, casoEventosListResponseSchema),
    }
  }, CasosController.getEventos);
};
