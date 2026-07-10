import { and, eq, isNull } from "drizzle-orm";
import { db } from "../index.js";
import { adjuntos, casos } from "../schema.js";

export type AdjuntoScope = "CLIENTE" | "CASO";
type NewAdjunto = typeof adjuntos.$inferInsert;

export class AdjuntosQueries {
  /** TODO: servir descargas de adjuntos vía backend en lugar de link directo a Drive. */
  static async findAdjuntosByScope(scope: AdjuntoScope, scopeId: number, estudioId: number) {
    return await db
      .select()
      .from(adjuntos)
      .where(and(eq(adjuntos.scope, scope), eq(adjuntos.scopeId, scopeId), eq(adjuntos.estudioId, estudioId), isNull(adjuntos.eliminadoEn)));
  }

  static async ensureCasoVivo(casoId: number, estudioId: number) {
    const [caso] = await db
      .select({ id: casos.id })
      .from(casos)
      .where(and(eq(casos.id, casoId), eq(casos.estudioId, estudioId), isNull(casos.deletedAt)))
      .limit(1);
    return caso ?? null;
  }

  static async findAdjuntoById(id: number, estudioId: number) {
    const [row] = await db
      .select()
      .from(adjuntos)
      .where(and(eq(adjuntos.id, id), eq(adjuntos.estudioId, estudioId), isNull(adjuntos.eliminadoEn)))
      .limit(1);
    return row ?? null;
  }

  static async insertAdjunto(data: Omit<NewAdjunto, "estudioId">, estudioId: number) {
    const [row] = await db.insert(adjuntos).values({ ...data, estudioId }).returning();
    return row;
  }

  static async softDeleteAdjunto(id: number, estudioId: number) {
    const [row] = await db
      .update(adjuntos)
      .set({ eliminadoEn: new Date() })
      .where(and(eq(adjuntos.id, id), eq(adjuntos.estudioId, estudioId), isNull(adjuntos.eliminadoEn)))
      .returning();
    return row ?? null;
  }

  static async softDeleteMissingFromFolder(estudioId: number, scope: AdjuntoScope, scopeId: number, driveFileId: string) {
    await db
      .update(adjuntos)
      .set({ eliminadoEn: new Date() })
      .where(and(
        eq(adjuntos.estudioId, estudioId),
        eq(adjuntos.scope, scope),
        eq(adjuntos.scopeId, scopeId),
        eq(adjuntos.driveFileId, driveFileId),
        isNull(adjuntos.eliminadoEn)
      ));
  }
}
