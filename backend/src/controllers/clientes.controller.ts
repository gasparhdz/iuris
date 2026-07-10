import type { FastifyReply, FastifyRequest } from "fastify";
import { ClientesService } from "../services/clientes.service.js";
import { CuentaCorrienteService } from "../services/cuenta-corriente.service.js";
import type { CreateClienteInput, CreateContactoClienteInput, UpdateClienteInput, UpdateContactoClienteInput, clienteQuerySchema } from "../schemas/clientes.schema.js";
import type { z } from "zod";

type ClienteListQuery = z.infer<typeof clienteQuerySchema>;

export class ClientesController {
  static async findAll(request: FastifyRequest<{ Querystring: ClienteListQuery }>, reply: FastifyReply) {
    try {
      const result = await ClientesService.findAll(request.authUser.estudioId, request.query);
      return reply.send(result);
    } catch (error) {
      throw error;
    }
  }

  static async findById(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      const cliente = await ClientesService.findById(request.params.id, request.authUser.estudioId);
      return reply.send({ data: cliente });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CLIENTE_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
      }
      throw error;
    }
  }

  static async findDetalle(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      const detalle = await ClientesService.findDetalle(request.params.id, request.authUser.estudioId);
      return reply.send({ data: detalle });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CLIENTE_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
      }
      throw error;
    }
  }

  static async findCuentaCorriente(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      const cuenta = await CuentaCorrienteService.getCuentaCorrienteCliente(request.params.id, request.authUser.estudioId);
      return reply.send({ data: cuenta });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CLIENTE_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
      }
      throw error;
    }
  }

  static async findCuentasCorrientesResumen(
    request: FastifyRequest<{ Querystring: import("../schemas/clientes.schema.js").CuentaCorrienteResumenQueryInput }>,
    reply: FastifyReply,
  ) {
    const resumen = await CuentaCorrienteService.getResumenPorCliente(request.authUser.estudioId, request.query);
    return reply.send({ data: resumen });
  }

  static async create(request: FastifyRequest<{ Body: CreateClienteInput }>, reply: FastifyReply) {
    try {
      const cliente = await ClientesService.create(request.authUser.estudioId, request.authUser.id, request.body);
      return reply.status(201).send({ data: cliente });
    } catch (error) {
      throw error;
    }
  }

  static async update(request: FastifyRequest<{ Params: { id: number }; Body: UpdateClienteInput }>, reply: FastifyReply) {
    try {
      const cliente = await ClientesService.update(request.params.id, request.authUser.estudioId, request.authUser.id, request.body);
      return reply.send({ data: cliente });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CLIENTE_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
      }
      throw error;
    }
  }

  static async softDelete(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    try {
      await ClientesService.softDelete(request.params.id, request.authUser.estudioId, request.authUser.id);
      return reply.send({ data: { message: "Cliente eliminado" } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CLIENTE_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
      }
      if (error instanceof Error && error.message === "CLIENTE_HAS_LIVE_INGRESOS") {
        return reply.status(409).send({
          error: {
            code: "CONFLICT",
            message: "No se puede eliminar: el cliente tiene ingresos registrados",
          },
        });
      }
      throw error;
    }
  }

  static async createContacto(request: FastifyRequest<{ Params: { id: number }; Body: CreateContactoClienteInput }>, reply: FastifyReply) {
    try {
      const contacto = await ClientesService.createContacto(request.params.id, request.authUser.estudioId, request.authUser.id, request.body);
      return reply.status(201).send({ data: contacto });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CLIENTE_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
      }
      throw error;
    }
  }

  static async updateContacto(request: FastifyRequest<{ Params: { id: number; contactoId: number }; Body: UpdateContactoClienteInput }>, reply: FastifyReply) {
    try {
      const contacto = await ClientesService.updateContacto(request.params.contactoId, request.params.id, request.authUser.estudioId, request.authUser.id, request.body);
      return reply.send({ data: contacto });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CLIENTE_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
      }
      if (error instanceof Error && error.message === "CONTACTO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Contacto no encontrado" } });
      }
      throw error;
    }
  }

  static async deleteContacto(request: FastifyRequest<{ Params: { id: number; contactoId: number } }>, reply: FastifyReply) {
    try {
      await ClientesService.deleteContacto(request.params.contactoId, request.params.id, request.authUser.estudioId, request.authUser.id);
      return reply.send({ data: { message: "Contacto eliminado" } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "CLIENTE_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Cliente no encontrado" } });
      }
      if (error instanceof Error && error.message === "CONTACTO_NOT_FOUND") {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Contacto no encontrado" } });
      }
      throw error;
    }
  }
}
