import { CasosQueries } from "../db/queries/casos.queries.js";
import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { EventosQueries } from "../db/queries/eventos.queries.js";
import { serializeDates } from "../utils/serialize.js";
import type { CreateEventoInput, UpdateEventoInput } from "../schemas/eventos.schema.js";
import { AuditoriaService, calcDiff } from "./auditoria.service.js";

export class EventosService {
  static async findAll(estudioId: number, query: { from?: string; to?: string; page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    const { data, count } = await EventosQueries.findAll(estudioId, limit, offset, from, to);

    return {
      data: {
        items: serializeDates(data),
        meta: { total: count, page, limit },
      },
    };
  }

  static async findById(id: number, estudioId: number) {
    const evento = await EventosQueries.findById(id, estudioId);
    if (!evento) throw new Error("EVENTO_NOT_FOUND");
    return serializeDates(evento);
  }

  static async create(estudioId: number, userId: number, data: CreateEventoInput) {
    await validateTenantReferences(estudioId, data.clienteId, data.casoId);

    const evento = await EventosQueries.insert({
      ...data,
      estudioId,
      createdBy: userId,
      fechaInicio: new Date(data.fechaInicio),
      fechaFin: data.fechaFin ? new Date(data.fechaFin) : null,
      recordatorio: data.recordatorio ? new Date(data.recordatorio) : null,
    });
    await AuditoriaService.log({
      estudioId,
      usuarioId: userId,
      entidad: "evento",
      entidadId: evento.id,
      accion: "CREATE",
      descripcion: "Evento creado",
    });
    return serializeDates(evento);
  }

  static async update(id: number, estudioId: number, userId: number, data: UpdateEventoInput) {
    const before = await this.findById(id, estudioId);
    await validateTenantReferences(estudioId, data.clienteId, data.casoId);

    const { fechaInicio, fechaFin, recordatorio, ...rest } = data;
    const updateData: Parameters<typeof EventosQueries.update>[2] = { ...rest, updatedAt: new Date(), updatedBy: userId };
    if (fechaInicio !== undefined) updateData.fechaInicio = new Date(fechaInicio);
    if (fechaFin !== undefined) updateData.fechaFin = fechaFin ? new Date(fechaFin) : null;
    if (recordatorio !== undefined) updateData.recordatorio = recordatorio ? new Date(recordatorio) : null;

    const evento = await EventosQueries.update(id, estudioId, updateData);
    const diff = calcDiff(before as Record<string, unknown>, serializeDates(evento) as Record<string, unknown>);
    if (diff) {
      await AuditoriaService.log({
        estudioId,
        usuarioId: userId,
        entidad: "evento",
        entidadId: id,
        accion: "UPDATE",
        descripcion: "Evento actualizado",
        cambios: diff,
      });
    }
    return serializeDates(evento);
  }

  static async softDelete(id: number, estudioId: number, userId: number) {
    await this.findById(id, estudioId);
    await EventosQueries.softDelete(id, estudioId, userId);
    await AuditoriaService.log({
      estudioId,
      usuarioId: userId,
      entidad: "evento",
      entidadId: id,
      accion: "DELETE",
      descripcion: "Evento eliminado",
    });
  }
}

async function validateTenantReferences(estudioId: number, clienteId?: number | null, casoId?: number | null) {
  if (clienteId !== undefined && clienteId !== null) {
    const cliente = await ClientesQueries.findById(clienteId, estudioId);
    if (!cliente) throw new Error("UNAUTHORIZED_TENANT_REFERENCE");
  }

  if (casoId !== undefined && casoId !== null) {
    const caso = await CasosQueries.findById(casoId, estudioId);
    if (!caso) throw new Error("UNAUTHORIZED_TENANT_REFERENCE");
  }
}
