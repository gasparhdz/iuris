import { db } from "../db/index.js";
import { CasosQueries } from "../db/queries/casos.queries.js";
import { ClientesQueries } from "../db/queries/clientes.queries.js";
import { TareasQueries } from "../db/queries/tareas.queries.js";
import { movimientosJudiciales, subTareas, tareas } from "../db/schema.js";
import { serializeDates } from "../utils/serialize.js";
import { and, eq, isNull } from "drizzle-orm";
import type { CreateTareaInput, TareaQueryInput, UpdateTareaInput } from "../schemas/tareas.schema.js";
import { AuditoriaService, calcDiff } from "./auditoria.service.js";

export class TareasService {
  static async findAll(estudioId: number, query: TareaQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    const completada = query.completada === "true"
      ? true
      : query.completada === "false"
        ? false
        : undefined;

    const { data, count } = await TareasQueries.findAll(estudioId, limit, offset, {
      completada,
      asignadoA: query.asignadoA,
      search: query.search,
      prioridadId: query.prioridadId,
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
    const tarea = await TareasQueries.findById(id, estudioId);
    if (!tarea) throw new Error("TAREA_NOT_FOUND");

    const items = await TareasQueries.findSubtareas(id, estudioId);
    return serializeDates({ ...tarea, items });
  }

  static async create(estudioId: number, userId: number, data: CreateTareaInput) {
    const { items, ...tareaData } = data;
    await validateTenantReferences(estudioId, tareaData.clienteId, tareaData.casoId, tareaData.movimientoId);

    const nuevaTarea = await db.transaction(async (tx) => {
      const nuevaTarea = await TareasQueries.insert(tx, {
        ...tareaData,
        estudioId,
        createdBy: userId,
        fechaLimite: tareaData.fechaLimite ? new Date(tareaData.fechaLimite) : null,
        recordatorio: tareaData.recordatorio ? new Date(tareaData.recordatorio) : null,
      });

      if (items && items.length > 0) {
        await TareasQueries.insertSubtareas(tx, items.map((item) => ({
          tareaId: nuevaTarea.id,
          titulo: item.titulo,
          orden: item.orden,
          completada: item.completada,
        })));
      }

      return serializeDates(nuevaTarea);
    });

    await AuditoriaService.log({
      estudioId,
      usuarioId: userId,
      entidad: "tarea",
      entidadId: nuevaTarea.id,
      accion: "CREATE",
      descripcion: "Tarea creada",
    });

    return nuevaTarea;
  }

  static async update(id: number, estudioId: number, userId: number, data: UpdateTareaInput) {
    const { items, fechaLimite, recordatorio, completarSubtareas, ...tareaData } = data;
    const before = await this.findById(id, estudioId);
    await ensureLinkedParentsAlive(estudioId, before);
    await validateTenantReferences(estudioId, tareaData.clienteId, tareaData.casoId, tareaData.movimientoId);

    const completadaYaCoincide =
      tareaData.completada !== undefined && Boolean(before.completada) === tareaData.completada;

    // Si solo piden el mismo estado de completada, devolver sin mutar ni re-auditar.
    const soloCompletada =
      Object.keys(data).every((key) => key === "completada" || key === "completarSubtareas");
    if (completadaYaCoincide && soloCompletada) {
      return before;
    }

    const updateValues: Parameters<typeof TareasQueries.update>[2] = { ...tareaData, updatedAt: new Date(), updatedBy: userId };
    if (fechaLimite !== undefined) updateValues.fechaLimite = fechaLimite ? new Date(fechaLimite) : null;
    if (recordatorio !== undefined) updateValues.recordatorio = recordatorio ? new Date(recordatorio) : null;

    if (tareaData.completada !== undefined) {
      if (completadaYaCoincide) {
        delete updateValues.completada;
      } else {
        updateValues.completadaAt = tareaData.completada ? new Date() : null;
      }
    }

    const fechaLimiteCambio = fechaLimite !== undefined
      && toIsoOrNull(before.fechaLimite) !== (fechaLimite ?? null);
    const recordatorioCambio = recordatorio !== undefined
      && toIsoOrNull(before.recordatorio) !== (recordatorio ?? null);
    if (fechaLimiteCambio || recordatorioCambio) {
      updateValues.recordatorioEnviado = false;
    }

    const updatedTarea = await db.transaction(async (tx) => {
      const [tarea] = await tx
        .update(tareas)
        .set(updateValues)
        .where(and(eq(tareas.id, id), eq(tareas.estudioId, estudioId)))
        .returning();

      if (!tarea) throw new Error("TAREA_NOT_FOUND");

      if (tareaData.completada && !completadaYaCoincide && completarSubtareas) {
        await tx
          .update(subTareas)
          .set({
            completada: true,
            completadaAt: new Date(),
          })
          .where(
            and(
              eq(subTareas.tareaId, id),
              eq(subTareas.completada, false),
              isNull(subTareas.deletedAt)
            )
          );
      }

      return serializeDates(tarea);
    });

    const diff = calcDiff(before as Record<string, unknown>, updatedTarea as Record<string, unknown>);
    if (diff) {
      await AuditoriaService.log({
        estudioId,
        usuarioId: userId,
        entidad: "tarea",
        entidadId: id,
        accion: "UPDATE",
        descripcion: "Tarea actualizada",
        cambios: diff,
      });
    }

    if (data.completada === true && !before.completada) {
      await AuditoriaService.log({
        estudioId,
        usuarioId: userId,
        entidad: "tarea",
        entidadId: id,
        accion: "COMPLETADA",
        descripcion: "Tarea marcada como completada",
      });
    }

    return updatedTarea;
  }

  static async softDelete(id: number, estudioId: number, userId: number) {
    const before = await this.findById(id, estudioId);
    await ensureLinkedParentsAlive(estudioId, before);
    await TareasQueries.softDelete(id, estudioId, userId);
    await AuditoriaService.log({
      estudioId,
      usuarioId: userId,
      entidad: "tarea",
      entidadId: id,
      accion: "DELETE",
      descripcion: "Tarea eliminada",
    });
  }

  // --- Sub-tareas ---

  static async addSubtarea(tareaId: number, estudioId: number, data: { titulo: string; orden?: number }) {
    const tarea = await this.findById(tareaId, estudioId);
    await ensureLinkedParentsAlive(estudioId, tarea);
    const sub = await TareasQueries.insertSubtarea({ tareaId, titulo: data.titulo, orden: data.orden || 0 });
    return serializeDates(sub);
  }

  static async toggleSubtarea(id: number, tareaId: number, estudioId: number) {
    const tarea = await this.findById(tareaId, estudioId);
    await ensureLinkedParentsAlive(estudioId, tarea);

    const sub = await TareasQueries.findSubtareaById(id, tareaId, estudioId);
    if (!sub) throw new Error("SUBTAREA_NOT_FOUND");

    await TareasQueries.updateSubtarea(id, tareaId, estudioId, {
      completada: !sub.completada,
      completadaAt: !sub.completada ? new Date() : null,
    });

    const items = await TareasQueries.findSubtareas(tareaId, estudioId);
    return serializeDates(items);
  }

  static async updateSubtarea(id: number, tareaId: number, estudioId: number, data: { titulo?: string; orden?: number }) {
    const tarea = await this.findById(tareaId, estudioId);
    await ensureLinkedParentsAlive(estudioId, tarea);

    const sub = await TareasQueries.findSubtareaById(id, tareaId, estudioId);
    if (!sub) throw new Error("SUBTAREA_NOT_FOUND");

    const updated = await TareasQueries.updateSubtarea(id, tareaId, estudioId, data);
    if (!updated) throw new Error("SUBTAREA_NOT_FOUND");
    return serializeDates(updated);
  }

  static async deleteSubtarea(id: number, tareaId: number, estudioId: number) {
    const tarea = await this.findById(tareaId, estudioId);
    await ensureLinkedParentsAlive(estudioId, tarea);

    const sub = await TareasQueries.findSubtareaById(id, tareaId, estudioId);
    if (!sub) throw new Error("SUBTAREA_NOT_FOUND");

    await TareasQueries.deleteSubtarea(id, tareaId, estudioId);
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

async function validateTenantReferences(estudioId: number, clienteId?: number | null, casoId?: number | null, movimientoId?: number | null) {
  if (clienteId !== undefined && clienteId !== null) {
    const cliente = await ClientesQueries.findById(clienteId, estudioId);
    if (!cliente) throw new Error("UNAUTHORIZED_TENANT_REFERENCE");
  }

  if (casoId !== undefined && casoId !== null) {
    const caso = await CasosQueries.findById(casoId, estudioId);
    if (!caso) throw new Error("UNAUTHORIZED_TENANT_REFERENCE");
  }

  if (movimientoId !== undefined && movimientoId !== null) {
    const [mov] = await db
      .select({ id: movimientosJudiciales.id })
      .from(movimientosJudiciales)
      .where(and(eq(movimientosJudiciales.id, movimientoId), eq(movimientosJudiciales.estudioId, estudioId)))
      .limit(1);
    if (!mov) throw new Error("UNAUTHORIZED_TENANT_REFERENCE");
  }
}

function toIsoOrNull(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return String(value);
}
