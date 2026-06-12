import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { casos, clientes, eventos, tareas, terceros } from "../db/schema.js";

// Cada sección del buscador se gatea por el permiso `ver` del módulo correspondiente:
// un usuario sin `ver` sobre CLIENTES no debe recibir clientes en los resultados (OWASP A01).
// El gate evita además correr la query cuyos datos se descartarían.
export type SearchModulos = {
  casos: boolean;
  clientes: boolean;
  terceros: boolean;
  tareas: boolean;
  eventos: boolean;
};

export class SearchService {
  static async globalSearch(estudioId: number, query: string, permitido: SearchModulos) {
    const trimmedQuery = query.trim();
    const cleanQuery = `%${escapeLike(trimmedQuery)}%`;

    const empty = {
      expedientes: [],
      clientes: [],
      terceros: [],
      tareas: [],
      eventos: [],
    };

    if (trimmedQuery.length < 2) {
      return empty;
    }

    const [expedientesData, clientesData, tercerosData, tareasData, eventosData] = await Promise.all([
      !permitido.casos ? Promise.resolve([]) : db
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
      !permitido.clientes ? Promise.resolve([]) : db
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
              // ILIKE sobre la MISMA expresión concatenada que indexa
              // `clientes_nombre_completo_trgm_idx` (migración 0026), para que el GIN trigram
              // se use. Antes el OR por columna no podía aprovechar ese índice.
              sql`(coalesce(${clientes.nombre}, '') || ' ' || coalesce(${clientes.apellido}, '') || ' ' || coalesce(${clientes.razonSocial}, '')) ILIKE ${cleanQuery}`,
              ilike(clientes.dni, cleanQuery),
              ilike(clientes.cuit, cleanQuery)
            )
          )
        )
        .limit(10),
      !permitido.terceros ? Promise.resolve([]) : db
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
              // Misma expresión que indexa `terceros_nombre_completo_trgm_idx` (migración 0026).
              sql`(coalesce(${terceros.nombre}, '') || ' ' || coalesce(${terceros.apellido}, '') || ' ' || coalesce(${terceros.razonSocial}, '')) ILIKE ${cleanQuery}`,
              ilike(terceros.dni, cleanQuery),
              ilike(terceros.cuit, cleanQuery)
            )
          )
        )
        .limit(10),
      !permitido.tareas ? Promise.resolve([]) : db
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
      !permitido.eventos ? Promise.resolve([]) : db
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

// Escapa los comodines de LIKE/ILIKE (\, %, _) para que el texto del usuario se
// trate como literal y no como patrón (evita que "100%" o "a_b" matcheen de más).
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
