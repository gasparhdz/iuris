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
  participantesElegiblesResponseSchema,
  casoTareasListResponseSchema, casoEventosListResponseSchema
} from "../schemas/casos.schema.js";

export const expedientesRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };
  const can = (accion: "ver" | "crear" | "editar" | "eliminar") => ({
    preHandler: [fastify.authenticate, fastify.authorize("CASOS", accion)],
  });

  server.get("/", {
    ...can("ver"),
    schema: {
      tags: ["Expedientes"],
      summary: "Listar expedientes",
      security: [{ bearerAuth: [] }],
      querystring: casoQuerySchema,
      response: documentedResponses(200, casoListResponseSchema),
    }
  }, CasosController.findAll);

  server.get("/:id", {
    ...can("ver"),
    schema: {
      tags: ["Expedientes"],
      summary: "Obtener un expediente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, casoResponseSchema),
    }
  }, CasosController.findById);

  server.post("/", {
    ...can("crear"),
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
    ...can("editar"),
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
    ...can("eliminar"),
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
    ...can("editar"),
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
    ...can("ver"),
    schema: {
      tags: ["Expedientes - Participantes"],
      summary: "Ver participantes del expediente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, participanteListResponseSchema),
    }
  }, CasosController.getParticipantes);

  server.get("/:id/participantes-elegibles", {
    ...can("ver"),
    schema: {
      tags: ["Expedientes - Participantes"],
      summary: "Participantes elegibles como obligado al pago (cliente + terceros)",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, participantesElegiblesResponseSchema),
    }
  }, CasosController.getParticipantesElegibles);

  server.delete("/:id/participantes/:participanteId", {
    ...can("editar"),
    schema: {
      tags: ["Expedientes - Participantes"],
      summary: "Quitar participante",
      security: [{ bearerAuth: [] }],
      params: participanteParamsSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    }
  }, CasosController.removeParticipante);

  server.put("/:id/participantes/:participanteId", {
    ...can("editar"),
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
    ...can("ver"),
    schema: {
      tags: ["Expedientes - Tareas"],
      summary: "Ver tareas del expediente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, casoTareasListResponseSchema),
    }
  }, CasosController.getTareas);

  server.get("/:id/eventos", {
    ...can("ver"),
    schema: {
      tags: ["Expedientes - Eventos"],
      summary: "Ver eventos del expediente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, casoEventosListResponseSchema),
    }
  }, CasosController.getEventos);
};
