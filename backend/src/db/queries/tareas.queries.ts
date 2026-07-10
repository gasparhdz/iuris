import { and, asc, desc, eq, getTableColumns, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../index.js";
import { casos, clientes, parametros, subTareas, tareas } from "../schema.js";
import { padresCasoClienteVivos } from "./padre-vivo.js";

type NewTarea = typeof tareas.$inferInsert;
type NewSubTarea = typeof subTareas.$inferInsert;
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | DbTransaction;

type TareaListFilters = {
  completada?: boolean;
  asignadoA?: number;
  search?: string;
  prioridadId?: number;
  orderBy?: "titulo" | "prioridad" | "vencimiento" | "vinculacion" | "checklist";
  order?: "asc" | "desc";
};

export class TareasQueries {
  static async findAll(
    estudioId: number,
    limit: number,
    offset: number,
    filters: TareaListFilters = {},
  ) {
    const { completada, asignadoA, search, prioridadId, orderBy = "titulo", order = "asc" } = filters;
    const conditions = [
      eq(tareas.estudioId, estudioId),
      isNull(tareas.deletedAt),
    ];

    if (completada !== undefined) conditions.push(eq(tareas.completada, completada));
    if (asignadoA) conditions.push(eq(tareas.asignadoA, asignadoA));
    if (prioridadId) conditions.push(eq(tareas.prioridadId, prioridadId));
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(ilike(tareas.titulo, term), ilike(tareas.descripcion, term))!);
    }

    const prioridadParam = alias(parametros, "tarea_prioridad_sort");
    const sortDir = order === "desc" ? desc : asc;
    const clienteNombre = sql`COALESCE(${clientes.razonSocial}, CONCAT_WS(' ', ${clientes.nombre}, ${clientes.apellido}), '')`;
    const vinculacionExpr = sql`trim(concat_ws(' ', ${clienteNombre}, coalesce(${casos.caratula}, ${casos.nroExpte}, '')))`;
    const checklistPercent = sql<number>`coalesce((
      select round(100.0 * count(*) filter (where ${subTareas.completada}) / nullif(count(*), 0))
      from ${subTareas}
      where ${subTareas.tareaId} = ${tareas.id}
        and ${subTareas.deletedAt} is null
    ), 0)`;
    const orderExpr = (() => {
      switch (orderBy) {
        case "prioridad":
          return sortDir(prioridadParam.nombre);
        case "vencimiento":
          return sortDir(tareas.fechaLimite);
        case "vinculacion":
          return sortDir(vinculacionExpr);
        case "checklist":
          return sortDir(checklistPercent);
        case "titulo":
        default:
          return sortDir(tareas.titulo);
      }
    })();

    const whereCondition = and(
      ...conditions,
      padresCasoClienteVivos({
        casoId: tareas.casoId,
        casoDeletedAt: casos.deletedAt,
        clienteId: tareas.clienteId,
        clienteDeletedAt: clientes.deletedAt,
      }),
    );

    const data = await db
      .select(getTableColumns(tareas))
      .from(tareas)
      .leftJoin(clientes, eq(tareas.clienteId, clientes.id))
      .leftJoin(casos, eq(tareas.casoId, casos.id))
      .leftJoin(prioridadParam, eq(tareas.prioridadId, prioridadParam.id))
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(orderExpr, asc(tareas.id));

    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(tareas)
      .leftJoin(clientes, eq(tareas.clienteId, clientes.id))
      .leftJoin(casos, eq(tareas.casoId, casos.id))
      .where(whereCondition);

    return { data, count };
  }

  static async findById(id: number, estudioId: number) {
    const [tarea] = await db
      .select()
      .from(tareas)
      .where(and(eq(tareas.id, id), eq(tareas.estudioId, estudioId), isNull(tareas.deletedAt)))
      .limit(1);

    return tarea ?? null;
  }

  static async insert(tx: DbExecutor, values: NewTarea) {
    const [row] = await tx.insert(tareas).values(values).returning();
    return row;
  }

  static async update(id: number, estudioId: number, values: Partial<NewTarea>) {
    const [row] = await db
      .update(tareas)
      .set(values)
      .where(and(eq(tareas.id, id), eq(tareas.estudioId, estudioId)))
      .returning();
    return row;
  }

  static async softDelete(id: number, estudioId: number, userId: number) {
    const [row] = await db
      .update(tareas)
      .set({ deletedAt: new Date(), deletedBy: userId, activo: false })
      .where(and(eq(tareas.id, id), eq(tareas.estudioId, estudioId), isNull(tareas.deletedAt)))
      .returning();

    return row ?? null;
  }

  static async findInRange(estudioId: number, from: Date, to: Date) {
    return await db
      .select(getTableColumns(tareas))
      .from(tareas)
      .leftJoin(clientes, eq(tareas.clienteId, clientes.id))
      .leftJoin(casos, eq(tareas.casoId, casos.id))
      .where(
        and(
          eq(tareas.estudioId, estudioId),
          isNull(tareas.deletedAt),
          gte(tareas.fechaLimite, from),
          lte(tareas.fechaLimite, to),
          padresCasoClienteVivos({
            casoId: tareas.casoId,
            casoDeletedAt: casos.deletedAt,
            clienteId: tareas.clienteId,
            clienteDeletedAt: clientes.deletedAt,
          }),
        )
      );
  }

  static async findByMovimientoId(movimientoId: number, estudioId: number) {
    const [tarea] = await db
      .select()
      .from(tareas)
      .where(and(
        eq(tareas.movimientoId, movimientoId),
        eq(tareas.estudioId, estudioId),
        isNull(tareas.deletedAt),
      ))
      .limit(1);
    return tarea ?? null;
  }

  static async findSubtareas(tareaId: number, estudioId: number) {
    return await db
      .select({
        id: subTareas.id,
        tareaId: subTareas.tareaId,
        titulo: subTareas.titulo,
        descripcion: subTareas.descripcion,
        completada: subTareas.completada,
        completadaAt: subTareas.completadaAt,
        orden: subTareas.orden,
        activo: subTareas.activo,
        deletedAt: subTareas.deletedAt,
      })
      .from(subTareas)
      .innerJoin(tareas, eq(subTareas.tareaId, tareas.id))
      .where(and(eq(subTareas.tareaId, tareaId), eq(tareas.estudioId, estudioId), isNull(tareas.deletedAt), isNull(subTareas.deletedAt)))
      .orderBy(subTareas.orden);
  }

  static async insertSubtareas(tx: DbExecutor, values: NewSubTarea[]) {
    await tx.insert(subTareas).values(values);
  }

  static async insertSubtarea(values: NewSubTarea) {
    const [row] = await db.insert(subTareas).values(values).returning();
    return row;
  }

  static async findSubtareaById(id: number, tareaId: number, estudioId: number) {
    const [sub] = await db
      .select({
        id: subTareas.id,
        tareaId: subTareas.tareaId,
        titulo: subTareas.titulo,
        descripcion: subTareas.descripcion,
        completada: subTareas.completada,
        completadaAt: subTareas.completadaAt,
        orden: subTareas.orden,
        activo: subTareas.activo,
        deletedAt: subTareas.deletedAt,
      })
      .from(subTareas)
      .innerJoin(tareas, eq(subTareas.tareaId, tareas.id))
      .where(and(eq(subTareas.id, id), eq(subTareas.tareaId, tareaId), eq(tareas.estudioId, estudioId), isNull(tareas.deletedAt)))
      .limit(1);
    return sub ?? null;
  }

  static async updateSubtarea(id: number, tareaId: number, estudioId: number, values: Partial<NewSubTarea>) {
    const [row] = await db
      .update(subTareas)
      .set(values)
      .where(and(eq(subTareas.id, id), eq(subTareas.tareaId, tareaId), taskBelongsToStudy(estudioId)))
      .returning();
    return row ?? null;
  }

  static async deleteSubtarea(id: number, tareaId: number, estudioId: number) {
    const [row] = await db
      .delete(subTareas)
      .where(and(eq(subTareas.id, id), eq(subTareas.tareaId, tareaId), taskBelongsToStudy(estudioId)))
      .returning();
    return row ?? null;
  }
}

function taskBelongsToStudy(estudioId: number) {
  return sql`exists (
    select 1 from ${tareas}
    where ${tareas.id} = ${subTareas.tareaId}
      and ${tareas.estudioId} = ${estudioId}
      and ${tareas.deletedAt} is null
  )`;
}
