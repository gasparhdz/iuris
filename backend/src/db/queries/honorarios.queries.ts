import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../index.js";
import { casos, categorias, clientes, honorarios, parametros } from "../schema.js";

type NewHonorario = typeof honorarios.$inferInsert;

export interface HonorarioPagination {
  limit: number;
  offset: number;
}

export interface HonorarioFilters {
  clienteId?: number;
  casoId?: number;
  estadoId?: number;
  search?: string;
}

export class HonorariosQueries {
  static async findHonorarios(estudioId: number, filters: HonorarioFilters, pagination: HonorarioPagination) {
    const conditions = [
      eq(honorarios.estudioId, estudioId),
      isNull(honorarios.deletedAt),
    ];

    if (filters.clienteId) conditions.push(eq(honorarios.clienteId, filters.clienteId));
    if (filters.casoId) conditions.push(eq(honorarios.casoId, filters.casoId));
    if (filters.estadoId) conditions.push(eq(honorarios.estadoId, filters.estadoId));
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(casos.caratula, term),
          ilike(casos.nroExpte, term),
          ilike(clientes.nombre, term),
          ilike(clientes.apellido, term),
          ilike(clientes.razonSocial, term),
          ilike(parametros.nombre, term)
        )!
      );
    }

    const whereCondition = and(...conditions);

    const data = await baseHonorariosSelect()
      .where(whereCondition)
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(desc(honorarios.fechaRegulacion), desc(honorarios.id));

    const [{ count }] = await db
      .select({ count: sql`count(distinct ${honorarios.id})`.mapWith(Number) })
      .from(honorarios)
      .leftJoin(clientes, eq(honorarios.clienteId, clientes.id))
      .leftJoin(casos, eq(honorarios.casoId, casos.id))
      .leftJoin(parametros, eq(honorarios.conceptoId, parametros.id))
      .where(whereCondition);

    return { data, count };
  }

  static async findHonorarioById(id: number, estudioId: number) {
    const [row] = await baseHonorariosSelect()
      .where(and(eq(honorarios.id, id), eq(honorarios.estudioId, estudioId), isNull(honorarios.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  static async insertHonorario(values: NewHonorario) {
    const [row] = await db.insert(honorarios).values(values).returning();
    return row;
  }

  static async updateHonorario(id: number, estudioId: number, values: Partial<NewHonorario>) {
    const [row] = await db
      .update(honorarios)
      .set(values)
      .where(and(eq(honorarios.id, id), eq(honorarios.estudioId, estudioId), isNull(honorarios.deletedAt)))
      .returning();

    return row ?? null;
  }

  static async deleteHonorario(id: number, estudioId: number, userId: number) {
    const [row] = await db
      .update(honorarios)
      .set({ deletedAt: new Date(), deletedBy: userId, activo: false })
      .where(and(eq(honorarios.id, id), eq(honorarios.estudioId, estudioId), isNull(honorarios.deletedAt)))
      .returning();

    return row ?? null;
  }

  static async findParametroByCodigo(categoriaCodigo: string, parametroCodigo: string) {
    const [row] = await db
      .select({ id: parametros.id })
      .from(parametros)
      .innerJoin(categorias, eq(parametros.categoriaId, categorias.id))
      .where(and(eq(categorias.codigo, categoriaCodigo), eq(parametros.codigo, parametroCodigo), eq(parametros.activo, true)))
      .limit(1);

    return row ?? null;
  }

  static async findParametroById(id: number) {
    const [row] = await db
      .select({
        id: parametros.id,
        codigo: parametros.codigo,
        nombre: parametros.nombre,
        categoriaCodigo: categorias.codigo,
      })
      .from(parametros)
      .innerJoin(categorias, eq(parametros.categoriaId, categorias.id))
      .where(and(eq(parametros.id, id), eq(parametros.activo, true)))
      .limit(1);

    return row ?? null;
  }
}

function baseHonorariosSelect() {
  const concepto = alias(parametros, "honorario_concepto");
  const parte = alias(parametros, "honorario_parte");
  const estado = alias(parametros, "honorario_estado");
  const moneda = alias(parametros, "honorario_moneda");

  return db
    .select({
      id: honorarios.id,
      estudioId: honorarios.estudioId,
      clienteId: honorarios.clienteId,
      casoId: honorarios.casoId,
      conceptoId: honorarios.conceptoId,
      parteId: honorarios.parteId,
      jus: honorarios.jus,
      montoPesos: honorarios.montoPesos,
      monedaId: honorarios.monedaId,
      valorJusRef: honorarios.valorJusRef,
      politicaJusId: honorarios.politicaJusId,
      fechaRegulacion: honorarios.fechaRegulacion,
      fechaVencimiento: honorarios.fechaVencimiento,
      tasaInteresMensual: honorarios.tasaInteresMensual,
      estadoId: honorarios.estadoId,
      activo: honorarios.activo,
      createdBy: honorarios.createdBy,
      createdAt: honorarios.createdAt,
      updatedAt: honorarios.updatedAt,
      updatedBy: honorarios.updatedBy,
      deletedAt: honorarios.deletedAt,
      deletedBy: honorarios.deletedBy,
      cliente: {
        id: clientes.id,
        nombre: clientes.nombre,
        apellido: clientes.apellido,
        razonSocial: clientes.razonSocial,
      },
      caso: {
        id: casos.id,
        nroExpte: casos.nroExpte,
        caratula: casos.caratula,
      },
      concepto: {
        id: concepto.id,
        codigo: concepto.codigo,
        nombre: concepto.nombre,
      },
      parte: {
        id: parte.id,
        codigo: parte.codigo,
        nombre: parte.nombre,
      },
      estado: {
        id: estado.id,
        codigo: estado.codigo,
        nombre: estado.nombre,
      },
      moneda: {
        id: moneda.id,
        codigo: moneda.codigo,
        nombre: moneda.nombre,
      },
    })
    .from(honorarios)
    .leftJoin(clientes, eq(honorarios.clienteId, clientes.id))
    .leftJoin(casos, eq(honorarios.casoId, casos.id))
    .leftJoin(concepto, eq(honorarios.conceptoId, concepto.id))
    .leftJoin(parte, eq(honorarios.parteId, parte.id))
    .leftJoin(estado, eq(honorarios.estadoId, estado.id))
    .leftJoin(moneda, eq(honorarios.monedaId, moneda.id));
}
