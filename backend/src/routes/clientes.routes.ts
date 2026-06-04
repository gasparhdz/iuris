import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ClientesController } from "../controllers/clientes.controller.js";
import { documentedResponses, successMessageResponseSchema } from "../schemas/common.schema.js";
import { methodNotAllowed } from "../utils/method-not-allowed.js";
import {
  createClienteSchema, updateClienteSchema,
  clienteQuerySchema, idParamSchema, contactoClienteParamsSchema,
  clienteResponseSchema, clienteListResponseSchema,
  clienteDetalleResponseSchema, contactoClienteResponseSchema,
  createContactoClienteSchema, updateContactoClienteSchema,
} from "../schemas/clientes.schema.js";

export const clientesRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };

  server.get("/", {
    ...authConfig,
    schema: {
      tags: ["Clientes"],
      summary: "Listar clientes del estudio (Paginado)",
      security: [{ bearerAuth: [] }],
      querystring: clienteQuerySchema,
      response: documentedResponses(200, clienteListResponseSchema),
    },
  }, ClientesController.findAll);

  server.get("/:id", {
    ...authConfig,
    schema: {
      tags: ["Clientes"],
      summary: "Obtener un cliente por ID",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, clienteResponseSchema),
    },
  }, ClientesController.findById);

  server.get("/:id/detalle", {
    ...authConfig,
    schema: {
      tags: ["Clientes"],
      summary: "Obtener workspace consolidado de un cliente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, clienteDetalleResponseSchema),
    },
  }, ClientesController.findDetalle);

  server.post("/:id/contactos", {
    ...authConfig,
    schema: {
      tags: ["Clientes"],
      summary: "Crear contacto secundario de un cliente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: createContactoClienteSchema,
      response: documentedResponses(201, contactoClienteResponseSchema),
    },
  }, ClientesController.createContacto);

  server.put("/:id/contactos/:contactoId", {
    ...authConfig,
    schema: {
      tags: ["Clientes"],
      summary: "Actualizar contacto secundario de un cliente",
      security: [{ bearerAuth: [] }],
      params: contactoClienteParamsSchema,
      body: updateContactoClienteSchema,
      response: documentedResponses(200, contactoClienteResponseSchema),
    },
  }, ClientesController.updateContacto);

  server.delete("/:id/contactos/:contactoId", {
    ...authConfig,
    schema: {
      tags: ["Clientes"],
      summary: "Eliminar contacto secundario de un cliente",
      security: [{ bearerAuth: [] }],
      params: contactoClienteParamsSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, ClientesController.deleteContacto);

  server.post("/", {
    ...authConfig,
    schema: {
      tags: ["Clientes"],
      summary: "Crear un nuevo cliente",
      security: [{ bearerAuth: [] }],
      body: createClienteSchema,
      response: documentedResponses(201, clienteResponseSchema),
    },
  }, ClientesController.create);

  server.put("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);
  server.patch("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);
  server.delete("/", { ...authConfig, schema: { hide: true } }, methodNotAllowed);

  server.put("/:id", {
    ...authConfig,
    schema: {
      tags: ["Clientes"],
      summary: "Actualizar un cliente existente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: updateClienteSchema,
      response: documentedResponses(200, clienteResponseSchema),
    },
  }, ClientesController.update);

  server.delete("/:id", {
    ...authConfig,
    schema: {
      tags: ["Clientes"],
      summary: "Eliminar un cliente (soft delete)",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, ClientesController.softDelete);
};
