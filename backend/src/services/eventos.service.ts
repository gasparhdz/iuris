import { db } from "../db/index.js";
import { CasosQueries } from "../db/queries/casos.queries.js";
import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { EventosQueries } from "../db/queries/eventos.queries.js";
import { serializeDates } from "../utils/serialize.js";
import type { CreateEventoInput, EventoQueryInput, UpdateEventoInput } from "../schemas/eventos.schema.js";
import { AuditoriaService, calcDiff } from "./auditoria.service.js";

export class EventosService {
  static async findAll(estudioId: number, query: EventoQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    const { data, count } = await EventosQueries.findAll(estudioId, limit, offset, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      search: query.search,
      tipoId: query.tipoId,
      estadoId: query.estadoId,
      upcoming: query.upcoming === "true" ? true : query.upcoming === "false" ? false : undefined,
      orderBy: query.orderBy,
      order: query.order,
    });

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

    const evento = await EventosQueries.insert(db, {
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
    await ensureLinkedParentsAlive(estudioId, before);
    await validateTenantReferences(estudioId, data.clienteId, data.casoId);

    const { fechaInicio, fechaFin, recordatorio, ...rest } = data;
    const updateData: Parameters<typeof EventosQueries.update>[2] = { ...rest, updatedAt: new Date(), updatedBy: userId };
    if (fechaInicio !== undefined) updateData.fechaInicio = new Date(fechaInicio);
    if (fechaFin !== undefined) updateData.fechaFin = fechaFin ? new Date(fechaFin) : null;
    if (recordatorio !== undefined) updateData.recordatorio = recordatorio ? new Date(recordatorio) : null;

    const fechaInicioCambio = fechaInicio !== undefined
      && toIsoOrNull(before.fechaInicio) !== (fechaInicio ?? null);
    const recordatorioCambio = recordatorio !== undefined
      && toIsoOrNull(before.recordatorio) !== (recordatorio ?? null);
    if (fechaInicioCambio || recordatorioCambio) {
      updateData.recordatorioEnviado = false;
    }

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
    const before = await this.findById(id, estudioId);
    await ensureLinkedParentsAlive(estudioId, before);
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

async function ensureLinkedParentsAlive(
  estudioId: number,
  item: { casoId?: number | null; clienteId?: number | null },
) {
  if (item.casoId != null) {
    const caso = await CasosQueries.findById(item.casoId, estudioId);
    if (!caso) throw new Error("PADRE_ELIMINADO");
  }
  if (item.clienteId != null) {
    const cliente = await ClientesQueries.findById(item.clienteId, estudioId);
    if (!cliente) throw new Error("PADRE_ELIMINADO");
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

function toIsoOrNull(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return String(value);
}
