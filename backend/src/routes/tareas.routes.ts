import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { TareasController } from "../controllers/tareas.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import { methodNotAllowed } from "../utils/method-not-allowed.js";
import {
  createTareaSchema, updateTareaSchema,
  createSubtareaSchema, updateSubtareaSchema,
  tareaQuerySchema, idParamSchema, subtareaParamsSchema,
  tareaResponseSchema, tareaDetailResponseSchema, tareaListResponseSchema,
  subtareaResponseSchema, subtareaToggleResponseSchema
} from "../schemas/tareas.schema.js";

export const tareasRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };
  const can = (accion: "ver" | "crear" | "editar" | "eliminar") => ({
    preHandler: [fastify.authenticate, fastify.authorize("TAREAS", accion)],
  });

  server.get("/", {
    ...can("ver"),
    schema: {
      tags: ["Tareas"],
      summary: "Listar tareas",
      security: [{ bearerAuth: [] }],
      querystring: tareaQuerySchema,
      response: documentedResponses(200, tareaListResponseSchema),
    }
  }, TareasController.findAll);

  server.get("/:id", {
    ...can("ver"),
    schema: {
      tags: ["Tareas"],
      summary: "Obtener una tarea con su checklist",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, tareaDetailResponseSchema),
    }
  }, TareasController.findById);

  server.post("/", {
    ...can("crear"),
    schema: {
      tags: ["Tareas"],
      summary: "Crear una tarea (opcionalmente con checklist)",
      security: [{ bearerAuth: [] }],
      body: createTareaSchema,
      response: documentedResponses(201, tareaResponseSchema),
    }
  }, TareasController.create);

  server.put("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);
  server.patch("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);
  server.delete("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);

  server.put("/:id", {
    ...can("editar"),
    schema: {
      tags: ["Tareas"],
      summary: "Actualizar una tarea",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: updateTareaSchema,
      response: documentedResponses(200, tareaResponseSchema),
    }
  }, TareasController.update);

  server.delete("/:id", {
    ...can("eliminar"),
    schema: {
      tags: ["Tareas"],
      summary: "Eliminar una tarea",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    }
  }, TareasController.softDelete);

  // --- Subtareas ---

  server.post("/:id/subtareas", {
    ...can("editar"),
    schema: {
      tags: ["Tareas - Subtareas"],
      summary: "Agregar subtarea a una tarea existente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: createSubtareaSchema,
      response: documentedResponses(201, subtareaResponseSchema),
    }
  }, TareasController.addSubtarea);

  server.patch("/:id/subtareas/:subtareaId/toggle", {
    ...can("editar"),
    schema: {
      tags: ["Tareas - Subtareas"],
      summary: "Marcar/Desmarcar una subtarea",
      security: [{ bearerAuth: [] }],
      params: subtareaParamsSchema,
      response: documentedResponses(200, subtareaToggleResponseSchema),
    }
  }, TareasController.toggleSubtarea);

  server.put("/:id/subtareas/:subtareaId", {
    ...can("editar"),
    schema: {
      tags: ["Tareas - Subtareas"],
      summary: "Editar una subtarea",
      security: [{ bearerAuth: [] }],
      params: subtareaParamsSchema,
      body: updateSubtareaSchema,
      response: documentedResponses(200, subtareaResponseSchema),
    }
  }, TareasController.updateSubtarea);

  server.delete("/:id/subtareas/:subtareaId", {
    ...can("editar"),
    schema: {
      tags: ["Tareas - Subtareas"],
      summary: "Eliminar una subtarea",
      security: [{ bearerAuth: [] }],
      params: subtareaParamsSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    }
  }, TareasController.deleteSubtarea);
};
