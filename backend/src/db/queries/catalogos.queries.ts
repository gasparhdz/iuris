import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../index.js";
import { categorias, codigosPostales, localidades, parametros, provincias } from "../schema.js";

export class CatalogosQueries {
  static async findProvincias() {
    return db
      .select({
        id: provincias.id,
        nombre: provincias.nombre,
        paisId: provincias.paisId,
      })
      .from(provincias)
      .orderBy(asc(provincias.nombre));
  }

  static async findLocalidades(provinciaId?: number) {
    const selection = {
      id: localidades.id,
      nombre: localidades.nombre,
      provinciaId: localidades.provinciaId,
      codigoPostal: sql<string | null>`min(${codigosPostales.codigo})`,
    };

    const baseQuery = db
      .select(selection)
      .from(localidades)
      .leftJoin(codigosPostales, eq(codigosPostales.localidadId, localidades.id));

    if (provinciaId) {
      return baseQuery
        .where(eq(localidades.provinciaId, provinciaId))
        .groupBy(localidades.id)
        .orderBy(asc(localidades.nombre));
    }

    return baseQuery
      .groupBy(localidades.id)
      .orderBy(asc(localidades.nombre));
  }

  static async findParametros(categoriaCodigo?: string) {
    const whereCondition = categoriaCodigo
      ? and(eq(categorias.codigo, categoriaCodigo), eq(parametros.activo, true))
      : eq(parametros.activo, true);

    return db
      .select({
        id: parametros.id,
        codigo: parametros.codigo,
        nombre: parametros.nombre,
        orden: parametros.orden,
        parentId: parametros.parentId,
        categoriaId: categorias.id,
        categoriaCodigo: categorias.codigo,
        categoriaNombre: categorias.nombre,
      })
      .from(parametros)
      .innerJoin(categorias, eq(parametros.categoriaId, categorias.id))
      .where(whereCondition)
      .orderBy(asc(categorias.id), asc(parametros.orden), asc(parametros.nombre));
  }

  /** Devuelve el parámetro de la categoría dada solo si existe y está activo. */
  static async findActiveParametroByIdAndCategoria(id: number, categoriaCodigo: string) {
    const [row] = await db
      .select({ id: parametros.id, codigo: parametros.codigo })
      .from(parametros)
      .innerJoin(categorias, eq(parametros.categoriaId, categorias.id))
      .where(and(eq(parametros.id, id), eq(categorias.codigo, categoriaCodigo), eq(parametros.activo, true)))
      .limit(1);
    return row ?? null;
  }
}
