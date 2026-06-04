import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { casos, clientes, eventos, tareas, terceros } from "../db/schema.js";

export class SearchService {
  static async globalSearch(estudioId: number, query: string) {
    const trimmedQuery = query.trim();
    const cleanQuery = `%${trimmedQuery}%`;

    if (trimmedQuery.length < 2) {
      return {
        expedientes: [],
        clientes: [],
        terceros: [],
        tareas: [],
        eventos: [],
      };
    }

    const [expedientesData, clientesData, tercerosData, tareasData, eventosData] = await Promise.all([
      db
        .select({
          id: casos.id,
          nroExpte: casos.nroExpte,
          caratula: casos.caratula,
          descripcion: casos.descripcion,
          updatedAt: casos.updatedAt,
          createdAt: casos.createdAt,
        })
        .from(casos)
        .where(
          and(
            eq(casos.estudioId, estudioId),
            eq(casos.activo, true),
            isNull(casos.deletedAt),
            or(
              ilike(casos.nroExpte, cleanQuery),
              ilike(casos.caratula, cleanQuery),
              ilike(casos.descripcion, cleanQuery)
            )
          )
        )
        .limit(10),
      db
        .select({
          id: clientes.id,
          nombre: clientes.nombre,
          apellido: clientes.apellido,
          razonSocial: clientes.razonSocial,
          dni: clientes.dni,
          cuit: clientes.cuit,
          updatedAt: clientes.updatedAt,
          createdAt: clientes.createdAt,
        })
        .from(clientes)
        .where(
          and(
            eq(clientes.estudioId, estudioId),
            eq(clientes.activo, true),
            isNull(clientes.deletedAt),
            or(
              ilike(clientes.nombre, cleanQuery),
              ilike(clientes.apellido, cleanQuery),
              ilike(clientes.razonSocial, cleanQuery),
              ilike(clientes.dni, cleanQuery),
              ilike(clientes.cuit, cleanQuery)
            )
          )
        )
        .limit(10),
      db
        .select({
          id: terceros.id,
          nombre: terceros.nombre,
          apellido: terceros.apellido,
          razonSocial: terceros.razonSocial,
          dni: terceros.dni,
          cuit: terceros.cuit,
          updatedAt: terceros.updatedAt,
          createdAt: terceros.createdAt,
        })
        .from(terceros)
        .where(
          and(
            eq(terceros.estudioId, estudioId),
            eq(terceros.activo, true),
            isNull(terceros.deletedAt),
            or(
              ilike(terceros.nombre, cleanQuery),
              ilike(terceros.apellido, cleanQuery),
              ilike(terceros.razonSocial, cleanQuery),
              ilike(terceros.dni, cleanQuery),
              ilike(terceros.cuit, cleanQuery)
            )
          )
        )
        .limit(10),
      db
        .select({
          id: tareas.id,
          titulo: tareas.titulo,
          descripcion: tareas.descripcion,
          fechaLimite: tareas.fechaLimite,
          completada: tareas.completada,
          updatedAt: tareas.updatedAt,
          createdAt: tareas.createdAt,
        })
        .from(tareas)
        .where(
          and(
            eq(tareas.estudioId, estudioId),
            eq(tareas.activo, true),
            isNull(tareas.deletedAt),
            or(
              ilike(tareas.titulo, cleanQuery),
              ilike(tareas.descripcion, cleanQuery)
            )
          )
        )
        .limit(10),
      db
        .select({
          id: eventos.id,
          descripcion: eventos.descripcion,
          observaciones: eventos.observaciones,
          fechaInicio: eventos.fechaInicio,
          updatedAt: eventos.updatedAt,
          createdAt: eventos.createdAt,
        })
        .from(eventos)
        .where(
          and(
            eq(eventos.estudioId, estudioId),
            eq(eventos.activo, true),
            isNull(eventos.deletedAt),
            or(
              ilike(eventos.descripcion, cleanQuery),
              ilike(eventos.observaciones, cleanQuery)
            )
          )
        )
        .limit(10),
    ]);

    return {
      expedientes: expedientesData,
      clientes: clientesData,
      terceros: tercerosData,
      tareas: tareasData,
      eventos: eventosData,
    };
  }
}
