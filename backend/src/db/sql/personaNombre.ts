import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

function personaNombreCoalesce(
  razonSocial: AnyPgColumn,
  apellido: AnyPgColumn,
  nombre: AnyPgColumn,
): SQL {
  return sql`COALESCE(
    NULLIF(TRIM(${razonSocial}), ''),
    NULLIF(CONCAT_WS(', ', NULLIF(TRIM(${apellido}), ''), NULLIF(TRIM(${nombre}), '')), ''),
    NULLIF(TRIM(${nombre}), ''),
    ''
  )`;
}

/** Label key: razón social ó "Apellido, Nombre". */
export function personaNombreExpr(
  razonSocial: AnyPgColumn,
  apellido: AnyPgColumn,
  nombre: AnyPgColumn,
): SQL {
  return personaNombreCoalesce(razonSocial, apellido, nombre);
}

/** Case-insensitive sort key aligned with UI labels. */
export function personaNombreSortExpr(
  razonSocial: AnyPgColumn,
  apellido: AnyPgColumn,
  nombre: AnyPgColumn,
): SQL {
  return sql`lower(COALESCE(
    NULLIF(TRIM(${razonSocial}), ''),
    NULLIF(CONCAT_WS(', ', NULLIF(TRIM(${apellido}), ''), NULLIF(TRIM(${nombre}), '')), ''),
    NULLIF(TRIM(${nombre}), ''),
    ''
  ))`;
}

/**
 * Sort for "Expte / Cliente": carátula del expediente si existe;
 * si no, nombre del cliente (mismo criterio que la UI).
 */
export function vinculacionExpteClienteSortExpr(
  caratula: AnyPgColumn,
  razonSocial: AnyPgColumn,
  apellido: AnyPgColumn,
  nombre: AnyPgColumn,
): SQL {
  return sql`lower(COALESCE(
    NULLIF(TRIM(${caratula}), ''),
    NULLIF(TRIM(${razonSocial}), ''),
    NULLIF(CONCAT_WS(', ', NULLIF(TRIM(${apellido}), ''), NULLIF(TRIM(${nombre}), '')), ''),
    NULLIF(TRIM(${nombre}), ''),
    ''
  ))`;
}
