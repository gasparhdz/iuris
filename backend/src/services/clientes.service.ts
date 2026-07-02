import type { z } from "zod";
import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { serializeDates } from "../utils/serialize.js";
import type { CreateClienteInput, CreateContactoClienteInput, UpdateClienteInput, UpdateContactoClienteInput, clienteQuerySchema } from "../schemas/clientes.schema.js";
import { ValorJusService } from "./valorjus.service.js";
import { AuditoriaService, calcDiff } from "./auditoria.service.js";
import { SoftDeleteService } from "./soft-delete.service.js";

type ClienteListQuery = z.infer<typeof clienteQuerySchema>;

export class ClientesService {
  static async findAll(estudioId: number, query: ClienteListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const { data, count } = await ClientesQueries.findAll(estudioId, limit, offset, {
      search: query.search,
      tipo: query.tipo,
      estado: query.estado,
      orderBy: query.orderBy,
      order: query.order,
    });

    return {
      data: {
        items: serializeDates(data),
        meta: {
          total: count,
          page,
          limit,
        },
      },
    };
  }

  static async findById(id: number, estudioId: number) {
    const cliente = await ClientesQueries.findById(id, estudioId);
    if (!cliente) throw new Error("CLIENTE_NOT_FOUND");
    return serializeDates(cliente);
  }

  static async findDetalle(id: number, estudioId: number) {
    const cliente = await ClientesQueries.findById(id, estudioId);
    if (!cliente) throw new Error("CLIENTE_NOT_FOUND");

    const [
      contactos,
      casos,
      tareas,
      eventos,
      honorarios,
      gastos,
      ingresos,
      notas,
    ] = await Promise.all([
      ClientesQueries.findContactos(id, estudioId),
      ClientesQueries.findCasosByCliente(id, estudioId),
      ClientesQueries.findTareasByCliente(id, estudioId),
      ClientesQueries.findEventosByCliente(id, estudioId),
      ClientesQueries.findHonorariosByCliente(id, estudioId),
      ClientesQueries.findGastosByCliente(id, estudioId),
      ClientesQueries.findIngresosByCliente(id, estudioId),
      ClientesQueries.findNotasByCliente(id, estudioId),
    ]);

    // Poblamos valorJusRef histórico para honorarios en JUS que no lo tengan guardado
    const honorariosProcesados = await Promise.all(honorarios.map(async (h) => {
      const isJus = Number(h.jus) > 0;
      if (isJus && (h.valorJusRef === null || Number(h.valorJusRef) === 0)) {
        const snap = await ValorJusService.getValorJusSnapshot(h.fechaRegulacion, estudioId);
        return {
          ...h,
          valorJusRef: snap !== null ? String(snap) : null,
        };
      }
      return h;
    }));

    return serializeDates({
      cliente: {
        ...cliente,
        contactos,
      },
      casos,
      tareas,
      eventos,
      honorarios: honorariosProcesados,
      gastos,
      ingresos,
      notas,
    });
  }

  static async create(estudioId: number, userId: number, data: CreateClienteInput) {
    const dni = normalizeNullableText(data.dni);
    const cuit = normalizeNullableText(data.cuit);
    const duplicate = await ClientesQueries.findDuplicateByDniOrCuit(estudioId, dni, cuit);
    if (duplicate) throw new Error("CLIENT_DUPLICATE_DNI_OR_CUIT");

    const insertData: Parameters<typeof ClientesQueries.insert>[0] = {
      ...data,
      dni,
      cuit,
      estudioId,
      createdBy: userId,
      fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : null,
    };

    const nuevoCliente = await ClientesQueries.insert(insertData);
    await AuditoriaService.log({
      estudioId,
      usuarioId: userId,
      entidad: "cliente",
      entidadId: nuevoCliente.id,
      accion: "CREATE",
      descripcion: "Cliente creado",
    });
    return serializeDates(nuevoCliente);
  }

  static async update(id: number, estudioId: number, userId: number, data: UpdateClienteInput) {
    const before = await this.findById(id, estudioId);

    const { fechaNacimiento, ...rest } = data;
    const updateData: Parameters<typeof ClientesQueries.update>[2] = { ...rest, updatedAt: new Date(), updatedBy: userId };
    if (fechaNacimiento !== undefined) {
      updateData.fechaNacimiento = fechaNacimiento ? new Date(fechaNacimiento) : null;
    }

    const updatedCliente = await ClientesQueries.update(id, estudioId, updateData);
    const diff = calcDiff(before as Record<string, unknown>, serializeDates(updatedCliente) as Record<string, unknown>);
    if (diff) {
      await AuditoriaService.log({
        estudioId,
        usuarioId: userId,
        entidad: "cliente",
        entidadId: id,
        accion: "UPDATE",
        descripcion: "Cliente actualizado",
        cambios: diff,
      });
    }
    return serializeDates(updatedCliente);
  }

  static async softDelete(id: number, estudioId: number, userId: number) {
    const { deleted } = await SoftDeleteService.softDeleteCliente(id, estudioId, userId);
    return serializeDates(deleted);
  }

  static async createContacto(clienteId: number, estudioId: number, userId: number, data: CreateContactoClienteInput) {
    await this.findById(clienteId, estudioId);
    const contacto = await ClientesQueries.insertContacto(clienteId, estudioId, { ...normalizeContacto(data), createdBy: userId });
    return serializeDates(contacto);
  }

  static async updateContacto(contactoId: number, clienteId: number, estudioId: number, userId: number, data: UpdateContactoClienteInput) {
    await this.findById(clienteId, estudioId);
    const updated = await ClientesQueries.updateContacto(contactoId, clienteId, estudioId, { ...normalizeContacto(data), updatedAt: new Date(), updatedBy: userId });
    if (!updated) throw new Error("CONTACTO_NOT_FOUND");
    return serializeDates(updated);
  }

  static async deleteContacto(contactoId: number, clienteId: number, estudioId: number, userId: number) {
    await this.findById(clienteId, estudioId);
    const deleted = await ClientesQueries.deleteContacto(contactoId, clienteId, estudioId, userId);
    if (!deleted) throw new Error("CONTACTO_NOT_FOUND");
    return serializeDates(deleted);
  }
}

function normalizeContacto<T extends CreateContactoClienteInput | UpdateContactoClienteInput>(data: T) {
  const normalized = { ...data };
  for (const field of ["rol", "email", "telefono", "observaciones"] as const) {
    if (field in normalized && typeof normalized[field] === "string" && normalized[field]?.trim() === "") {
      normalized[field] = null;
    }
  }
  return normalized;
}

function normalizeNullableText(value?: string | null) {
  if (typeof value !== "string") return value ?? null;
  const text = value.trim();
  return text === "" ? null : text;
}
