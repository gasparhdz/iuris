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
  cuentaCorrienteResponseSchema, cuentaCorrienteResumenResponseSchema, cuentaCorrienteResumenQuerySchema,
  createContactoClienteSchema, updateContactoClienteSchema,
} from "../schemas/clientes.schema.js";

export const clientesRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<ZodTypeProvider>();
  const authConfig = { preHandler: [fastify.authenticate] };
  const can = (accion: "ver" | "crear" | "editar" | "eliminar") => ({
    preHandler: [fastify.authenticate, fastify.authorize("CLIENTES", accion)],
  });

  server.get("/", {
    ...can("ver"),
    schema: {
      tags: ["Clientes"],
      summary: "Listar clientes del estudio (Paginado)",
      security: [{ bearerAuth: [] }],
      querystring: clienteQuerySchema,
      response: documentedResponses(200, clienteListResponseSchema),
    },
  }, ClientesController.findAll);

  server.get("/:id", {
    ...can("ver"),
    schema: {
      tags: ["Clientes"],
      summary: "Obtener un cliente por ID",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, clienteResponseSchema),
    },
  }, ClientesController.findById);

  server.get("/:id/detalle", {
    ...can("ver"),
    schema: {
      tags: ["Clientes"],
      summary: "Obtener workspace consolidado de un cliente",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, clienteDetalleResponseSchema),
    },
  }, ClientesController.findDetalle);

  server.get("/:id/cuenta-corriente", {
    preHandler: [fastify.authenticate, fastify.authorize("CLIENTES", "ver"), fastify.authorize("HONORARIOS", "ver")],
    schema: {
      tags: ["Clientes"],
      summary: "Cuenta corriente del cliente (libro mayor calculado en backend)",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, cuentaCorrienteResponseSchema),
    },
  }, ClientesController.findCuentaCorriente);

  server.get("/cuentas-corrientes", {
    preHandler: [fastify.authenticate, fastify.authorize("CLIENTES", "ver"), fastify.authorize("HONORARIOS", "ver")],
    schema: {
      tags: ["Clientes"],
      summary: "Resumen de cuenta corriente por cliente (todo el estudio)",
      security: [{ bearerAuth: [] }],
      querystring: cuentaCorrienteResumenQuerySchema,
      response: documentedResponses(200, cuentaCorrienteResumenResponseSchema),
    },
  }, ClientesController.findCuentasCorrientesResumen);

  server.post("/:id/contactos", {
    ...can("editar"),
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
    ...can("editar"),
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
    ...can("editar"),
    schema: {
      tags: ["Clientes"],
      summary: "Eliminar contacto secundario de un cliente",
      security: [{ bearerAuth: [] }],
      params: contactoClienteParamsSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, ClientesController.deleteContacto);

  server.post("/", {
    ...can("crear"),
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
    ...can("editar"),
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
    ...can("eliminar"),
    schema: {
      tags: ["Clientes"],
      summary: "Eliminar un cliente (soft delete)",
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: documentedResponses(200, successMessageResponseSchema),
    },
  }, ClientesController.softDelete);
};
