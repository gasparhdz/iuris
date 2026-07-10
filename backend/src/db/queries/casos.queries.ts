import { and, asc, desc, eq, getTableColumns, ilike, isNull, or, sql, aliasedTable } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../index.js";
import { casos, clientes, participantesCaso, usuarios, tareas, eventos, terceros, parametros, categorias } from "../schema.js";

type NewCaso = typeof casos.$inferInsert;
type NewParticipanteCaso = typeof participantesCaso.$inferInsert;

type CasoListFilters = {
  search?: string;
  estadoId?: number;
  ramaId?: number;
  radicacionParentId?: number;
  orderBy?: "caratula" | "cliente" | "nroExpte" | "tipo" | "juzgado" | "estado";
  order?: "asc" | "desc";
};

export class CasosQueries {
  static async findAll(
    estudioId: number,
    limit: number,
    offset: number,
    filters: CasoListFilters = {},
  ) {
    const { search, estadoId, ramaId, radicacionParentId, orderBy = "caratula", order = "asc" } = filters;
    const conditions = [
      eq(casos.estudioId, estudioId),
      isNull(casos.deletedAt),
    ];

    if (search) {
      const normalized = search.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      conditions.push(
        or(
          ilike(casos.caratula, `%${search}%`),
          ilike(casos.nroExpteNorm, `%${normalized}%`),
          and(
            isNull(clientes.deletedAt),
            or(
              ilike(clientes.nombre, `%${search}%`),
              ilike(clientes.apellido, `%${search}%`),
              ilike(clientes.razonSocial, `%${search}%`),
            )!,
          )!,
        )!
      );
    }

    if (estadoId) conditions.push(eq(casos.estadoId, estadoId));
    if (ramaId) {
      conditions.push(sql`${casos.tipoId} IN (SELECT id FROM parametros WHERE parent_id = ${ramaId})`);
    }
    if (radicacionParentId) {
      conditions.push(sql`${casos.radicacionId} IN (SELECT id FROM parametros WHERE parent_id = ${radicacionParentId})`);
    }

    const whereCondition = and(...conditions);

    const tipoParam = alias(parametros, "caso_tipo_sort");
    const estadoParam = alias(parametros, "caso_estado_sort");
    const radicacionParam = alias(parametros, "caso_radicacion_sort");
    const sortDir = order === "desc" ? desc : asc;
    const clienteNombre = sql`COALESCE(${clientes.razonSocial}, CONCAT_WS(' ', ${clientes.nombre}, ${clientes.apellido}), '')`;
    const orderExpr = (() => {
      switch (orderBy) {
        case "cliente":
          return sortDir(clienteNombre);
        case "nroExpte":
          return sortDir(casos.nroExpte);
        case "tipo":
          return sortDir(tipoParam.nombre);
        case "juzgado":
          return sortDir(radicacionParam.nombre);
        case "estado":
          return sortDir(estadoParam.nombre);
        case "caratula":
        default:
          return sortDir(casos.caratula);
      }
    })();

    const data = await db
      .select(getTableColumns(casos))
      .from(casos)
      .leftJoin(clientes, eq(casos.clienteId, clientes.id))
      .leftJoin(tipoParam, eq(casos.tipoId, tipoParam.id))
      .leftJoin(estadoParam, eq(casos.estadoId, estadoParam.id))
      .leftJoin(radicacionParam, eq(casos.radicacionId, radicacionParam.id))
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(orderExpr, asc(casos.id));

    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(casos)
      .leftJoin(clientes, eq(casos.clienteId, clientes.id))
      .where(whereCondition);

    return { data, count };
  }

  static async findById(id: number, estudioId: number) {
    const creador = aliasedTable(usuarios, "creador");
    const modificador = aliasedTable(usuarios, "modificador");
    const responsable = aliasedTable(usuarios, "responsable");

    const [row] = await db
      .select({
        caso: casos,
        creadoPorNombre: sql<string>`concat(${creador.nombre}, ' ', ${creador.apellido})`,
        modificadoPorNombre: sql<string>`concat(${modificador.nombre}, ' ', ${modificador.apellido})`,
        responsableNombre: sql<string>`concat(${responsable.nombre}, ' ', ${responsable.apellido})`,
      })
      .from(casos)
      .leftJoin(creador, eq(casos.createdBy, creador.id))
      .leftJoin(modificador, eq(casos.updatedBy, modificador.id))
      .leftJoin(responsable, eq(casos.responsableId, responsable.id))
      .where(and(eq(casos.id, id), eq(casos.estudioId, estudioId), isNull(casos.deletedAt)))
      .limit(1);

    if (!row) return null;

    return {
      ...row.caso,
      creadoPorNombre: row.creadoPorNombre || "Sistema",
      modificadoPorNombre: row.modificadoPorNombre || null,
      responsableNombre: row.responsableNombre || null,
    };
  }

  static async findByNroExpteNorm(estudioId: number, nroExpteNorm: string) {
    const [caso] = await db
      .select()
      .from(casos)
      .where(and(eq(casos.estudioId, estudioId), eq(casos.nroExpteNorm, nroExpteNorm), isNull(casos.deletedAt)))
      .limit(1);

    return caso ?? null;
  }

  static async insert(values: NewCaso) {
    const [row] = await db.insert(casos).values(values).returning();
    return row;
  }

  static async update(id: number, estudioId: number, values: Partial<NewCaso>) {
    const [row] = await db
      .update(casos)
      .set(values)
      .where(and(eq(casos.id, id), eq(casos.estudioId, estudioId)))
      .returning();
    return row;
  }

  static async softDelete(id: number, estudioId: number, userId: number) {
    const [row] = await db
      .update(casos)
      .set({ deletedAt: new Date(), deletedBy: userId, activo: false })
      .where(and(eq(casos.id, id), eq(casos.estudioId, estudioId)))
      .returning();

    return row ?? null;
  }

  static async insertParticipante(values: NewParticipanteCaso) {
    const [row] = await db.insert(participantesCaso).values(values).returning();
    return row;
  }

  static async findParticipantes(casoId: number, estudioId: number) {
    return await db
      .select({
        id: participantesCaso.id,
        casoId: participantesCaso.casoId,
        terceroId: participantesCaso.terceroId,
        rolId: participantesCaso.rolId,
        rolCodigo: parametros.codigo,
        rolNombre: parametros.nombre,
        observaciones: participantesCaso.observaciones,
        tercero: {
          id: terceros.id,
          nombre: terceros.nombre,
          apellido: terceros.apellido,
          razonSocial: terceros.razonSocial,
          dni: terceros.dni,
          cuit: terceros.cuit,
          email: terceros.email,
          telefono: terceros.telefono,
        },
      })
      .from(participantesCaso)
      .innerJoin(casos, eq(participantesCaso.casoId, casos.id))
      .innerJoin(terceros, eq(participantesCaso.terceroId, terceros.id))
      .leftJoin(parametros, eq(participantesCaso.rolId, parametros.id))
      .where(and(
        eq(participantesCaso.casoId, casoId),
        eq(casos.estudioId, estudioId),
        isNull(casos.deletedAt),
        eq(terceros.estudioId, estudioId),
        isNull(terceros.deletedAt),
      ));
  }

  static async findParticipantesElegibles(casoId: number, estudioId: number) {
    const caso = await this.findById(casoId, estudioId);
    if (!caso) return null;

    const [clienteRow] = await db
      .select({
        id: clientes.id,
        nombre: clientes.nombre,
        apellido: clientes.apellido,
        razonSocial: clientes.razonSocial,
      })
      .from(clientes)
      .where(and(
        eq(clientes.id, caso.clienteId),
        eq(clientes.estudioId, estudioId),
        isNull(clientes.deletedAt),
      ))
      .limit(1);

    const [parteCliente] = await db
      .select({ id: parametros.id, nombre: parametros.nombre })
      .from(parametros)
      .innerJoin(categorias, eq(parametros.categoriaId, categorias.id))
      .where(and(
        eq(categorias.codigo, "PARTES"),
        eq(parametros.codigo, "CLIENTE"),
        eq(parametros.activo, true),
      ))
      .limit(1);

    const participantes = await this.findParticipantes(casoId, estudioId);

    const formatNombre = (persona: {
      razonSocial: string | null;
      apellido: string | null;
      nombre: string | null;
    }) => {
      if (persona.razonSocial) return persona.razonSocial;
      const compuesto = [persona.apellido, persona.nombre].filter(Boolean).join(", ");
      return compuesto || persona.nombre || "";
    };

    const elegibles: Array<{
      tipo: "cliente" | "tercero";
      id: number;
      rol: string;
      parteId: number | null;
      nombreCompleto: string;
    }> = [];

    if (clienteRow) {
      elegibles.push({
        tipo: "cliente",
        id: clienteRow.id,
        rol: parteCliente?.nombre ?? "Cliente",
        parteId: parteCliente?.id ?? null,
        nombreCompleto: formatNombre(clienteRow),
      });
    }

    for (const p of participantes) {
      if (!p.tercero?.id) continue;
      elegibles.push({
        tipo: "tercero",
        id: p.tercero.id,
        rol: p.rolNombre ?? "Participante",
        parteId: p.rolId,
        nombreCompleto: formatNombre(p.tercero),
      });
    }

    return elegibles;
  }

  static async updateParticipante(participanteId: number, casoId: number, estudioId: number, values: Partial<NewParticipanteCaso>) {
    const [row] = await db
      .update(participantesCaso)
      .set(values)
      .where(
        and(
          eq(participantesCaso.id, participanteId),
          eq(
            participantesCaso.casoId,
            db.select({ id: casos.id }).from(casos).where(and(eq(casos.id, casoId), eq(casos.estudioId, estudioId), isNull(casos.deletedAt)))
          )
        )
      )
      .returning();
    return row ?? null;
  }

  static async deleteParticipante(participanteId: number, casoId: number, estudioId: number) {
    const [row] = await db
      .delete(participantesCaso)
      .where(
        and(
          eq(participantesCaso.id, participanteId),
          eq(
            participantesCaso.casoId,
            db
              .select({ id: casos.id })
              .from(casos)
              .where(and(eq(casos.id, casoId), eq(casos.estudioId, estudioId), isNull(casos.deletedAt)))
          )
        )
      )
      .returning();

    return row ?? null;
  }

  static async findTareasByCaso(casoId: number, estudioId: number) {
    return await db
      .select()
      .from(tareas)
      .where(and(eq(tareas.casoId, casoId), eq(tareas.estudioId, estudioId), isNull(tareas.deletedAt)))
      .orderBy(sql`${tareas.completada} ASC, ${tareas.fechaLimite} ASC NULLS LAST`);
  }

  static async findEventosByCaso(casoId: number, estudioId: number) {
    return await db
      .select()
      .from(eventos)
      .where(and(eq(eventos.casoId, casoId), eq(eventos.estudioId, estudioId), isNull(eventos.deletedAt)))
      .orderBy(desc(eventos.fechaInicio), desc(eventos.id));
  }
}
