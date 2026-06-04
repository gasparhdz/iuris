import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  auditoriaLogs,
  casos,
  clientes,
  eventos,
  gastos,
  honorarios,
  ingresos,
  planCuotas,
  planesPago,
  tareas,
} from "../db/schema.js";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type AuditableEntity = "caso" | "cliente" | "tarea" | "evento" | "ingreso" | "gasto" | "honorario";
type SoftDeleteCounts = Partial<Record<AuditableEntity | "planPago" | "planCuota", number>>;

export class SoftDeleteService {
  static async softDeleteCliente(id: number, estudioId: number, userId: number) {
    return await db.transaction(async (tx) => {
      const [cliente] = await tx
        .select({ id: clientes.id })
        .from(clientes)
        .where(and(eq(clientes.id, id), eq(clientes.estudioId, estudioId), isNull(clientes.deletedAt)))
        .limit(1);

      if (!cliente) throw new Error("CLIENTE_NOT_FOUND");

      const casoRows = await tx
        .select({ id: casos.id })
        .from(casos)
        .where(and(eq(casos.clienteId, id), eq(casos.estudioId, estudioId), isNull(casos.deletedAt)));
      const casoIds = casoRows.map((row) => row.id);

      const ingresosVivos = await countLiveIngresos(tx, estudioId, or(
        eq(ingresos.clienteId, id),
        casoIds.length > 0 ? inArray(ingresos.casoId, casoIds) : undefined,
      ));
      if (ingresosVivos > 0) throw new Error("CLIENTE_HAS_LIVE_INGRESOS");

      const now = new Date();
      const counts: SoftDeleteCounts = {};

      await softDeleteCasoChildren(tx, { estudioId, userId, now, casoIds, clienteId: id, counts });

      const deletedCasos = casoIds.length > 0
        ? await tx
          .update(casos)
          .set({ deletedAt: now, deletedBy: userId, activo: false })
          .where(and(inArray(casos.id, casoIds), eq(casos.estudioId, estudioId), isNull(casos.deletedAt)))
          .returning({ id: casos.id })
        : [];
      counts.caso = deletedCasos.length;
      await auditRows(tx, estudioId, userId, "caso", deletedCasos.map((row) => row.id), "Expediente eliminado por baja de cliente");

      const [deletedCliente] = await tx
        .update(clientes)
        .set({ deletedAt: now, deletedBy: userId, activo: false })
        .where(and(eq(clientes.id, id), eq(clientes.estudioId, estudioId), isNull(clientes.deletedAt)))
        .returning();

      if (!deletedCliente) throw new Error("CLIENTE_NOT_FOUND");
      await auditRows(tx, estudioId, userId, "cliente", [id], "Cliente eliminado");

      return { deleted: deletedCliente, counts };
    });
  }

  static async softDeleteCaso(id: number, estudioId: number, userId: number) {
    return await db.transaction(async (tx) => {
      const [caso] = await tx
        .select({ id: casos.id })
        .from(casos)
        .where(and(eq(casos.id, id), eq(casos.estudioId, estudioId), isNull(casos.deletedAt)))
        .limit(1);

      if (!caso) throw new Error("CASO_NOT_FOUND");

      const ingresosVivos = await countLiveIngresos(tx, estudioId, eq(ingresos.casoId, id));
      if (ingresosVivos > 0) throw new Error("CASO_HAS_LIVE_INGRESOS");

      const now = new Date();
      const counts: SoftDeleteCounts = {};
      await softDeleteCasoChildren(tx, { estudioId, userId, now, casoIds: [id], counts });

      const [deletedCaso] = await tx
        .update(casos)
        .set({ deletedAt: now, deletedBy: userId, activo: false })
        .where(and(eq(casos.id, id), eq(casos.estudioId, estudioId), isNull(casos.deletedAt)))
        .returning();

      if (!deletedCaso) throw new Error("CASO_NOT_FOUND");
      counts.caso = 1;
      await auditRows(tx, estudioId, userId, "caso", [id], "Expediente eliminado");

      return { deleted: deletedCaso, counts };
    });
  }
}

async function softDeleteCasoChildren(
  tx: DbTransaction,
  input: {
    estudioId: number;
    userId: number;
    now: Date;
    casoIds: number[];
    clienteId?: number;
    counts: SoftDeleteCounts;
  }
) {
  const { estudioId, userId, now, casoIds, clienteId, counts } = input;
  const caseCondition = casoIds.length > 0 ? inArray(tareas.casoId, casoIds) : undefined;
  const childByCaseOrCliente = (caseColumn: typeof tareas.casoId, clienteColumn?: typeof tareas.clienteId) => or(
    casoIds.length > 0 ? inArray(caseColumn, casoIds) : undefined,
    clienteId !== undefined && clienteColumn ? eq(clienteColumn, clienteId) : undefined,
  );

  const deletedTareas = await tx
    .update(tareas)
    .set({ deletedAt: now, deletedBy: userId, activo: false })
    .where(and(eq(tareas.estudioId, estudioId), isNull(tareas.deletedAt), childByCaseOrCliente(tareas.casoId, tareas.clienteId)))
    .returning({ id: tareas.id });
  counts.tarea = deletedTareas.length;
  await auditRows(tx, estudioId, userId, "tarea", deletedTareas.map((row) => row.id), "Tarea eliminada por cascada");

  const deletedEventos = await tx
    .update(eventos)
    .set({ deletedAt: now, deletedBy: userId, activo: false })
    .where(and(eq(eventos.estudioId, estudioId), isNull(eventos.deletedAt), or(
      casoIds.length > 0 ? inArray(eventos.casoId, casoIds) : undefined,
      clienteId !== undefined ? eq(eventos.clienteId, clienteId) : undefined,
    )))
    .returning({ id: eventos.id });
  counts.evento = deletedEventos.length;
  await auditRows(tx, estudioId, userId, "evento", deletedEventos.map((row) => row.id), "Evento eliminado por cascada");

  const deletedGastos = await tx
    .update(gastos)
    .set({ deletedAt: now, deletedBy: userId, activo: false })
    .where(and(eq(gastos.estudioId, estudioId), isNull(gastos.deletedAt), or(
      casoIds.length > 0 ? inArray(gastos.casoId, casoIds) : undefined,
      clienteId !== undefined ? eq(gastos.clienteId, clienteId) : undefined,
    )))
    .returning({ id: gastos.id });
  counts.gasto = deletedGastos.length;
  await auditRows(tx, estudioId, userId, "gasto", deletedGastos.map((row) => row.id), "Gasto eliminado por cascada");

  const deletedHonorarios = await tx
    .update(honorarios)
    .set({ deletedAt: now, deletedBy: userId, activo: false })
    .where(and(eq(honorarios.estudioId, estudioId), isNull(honorarios.deletedAt), or(
      casoIds.length > 0 ? inArray(honorarios.casoId, casoIds) : undefined,
      clienteId !== undefined ? eq(honorarios.clienteId, clienteId) : undefined,
    )))
    .returning({ id: honorarios.id });
  counts.honorario = deletedHonorarios.length;
  await auditRows(tx, estudioId, userId, "honorario", deletedHonorarios.map((row) => row.id), "Honorario eliminado por cascada");

  const honorarioIds = deletedHonorarios.map((row) => row.id);
  const planRows = await tx
    .update(planesPago)
    .set({ deletedAt: now, deletedBy: userId, activo: false })
    .where(and(eq(planesPago.estudioId, estudioId), isNull(planesPago.deletedAt), or(
      casoIds.length > 0 ? inArray(planesPago.casoId, casoIds) : undefined,
      clienteId !== undefined ? eq(planesPago.clienteId, clienteId) : undefined,
      honorarioIds.length > 0 ? inArray(planesPago.honorarioId, honorarioIds) : undefined,
    )))
    .returning({ id: planesPago.id });
  counts.planPago = planRows.length;

  const planIds = planRows.map((row) => row.id);
  if (planIds.length > 0) {
    const deletedCuotas = await tx
      .update(planCuotas)
      .set({ deletedAt: now, deletedBy: userId, activo: false })
      .where(and(inArray(planCuotas.planId, planIds), isNull(planCuotas.deletedAt)))
      .returning({ id: planCuotas.id });
    counts.planCuota = deletedCuotas.length;
  }

  if (caseCondition) {
    counts.ingreso = 0;
  }
}

async function countLiveIngresos(tx: DbTransaction, estudioId: number, extraCondition: ReturnType<typeof or> | ReturnType<typeof eq>) {
  if (!extraCondition) return 0;
  const [row] = await tx
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(ingresos)
    .where(and(eq(ingresos.estudioId, estudioId), eq(ingresos.activo, true), isNull(ingresos.deletedAt), extraCondition));

  return row?.count ?? 0;
}

async function auditRows(
  tx: DbTransaction,
  estudioId: number,
  usuarioId: number,
  entidad: AuditableEntity,
  ids: number[],
  descripcion: string
) {
  if (ids.length === 0) return;
  await tx.insert(auditoriaLogs).values(ids.map((entidadId) => ({
    estudioId,
    usuarioId,
    entidad,
    entidadId,
    accion: "DELETE",
    descripcion,
  })));
}
