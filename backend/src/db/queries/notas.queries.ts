import { and, desc, eq, exists, isNull } from "drizzle-orm";
import { db } from "../index.js";
import { casos, notasCaso, notasCliente } from "../schema.js";

type NewNotaCliente = typeof notasCliente.$inferInsert;
type NewNotaCaso = typeof notasCaso.$inferInsert;

export class NotasQueries {
  static async findNotasByCliente(clienteId: number, estudioId: number) {
    return await db
      .select()
      .from(notasCliente)
      .where(and(eq(notasCliente.clienteId, clienteId), eq(notasCliente.estudioId, estudioId)))
      .orderBy(desc(notasCliente.createdAt));
  }

  static async findNotasByCaso(casoId: number, estudioId: number) {
    return await db
      .select()
      .from(notasCaso)
      .where(and(eq(notasCaso.casoId, casoId), eq(notasCaso.estudioId, estudioId)))
      .orderBy(desc(notasCaso.createdAt));
  }

  static async findNotaCasoById(id: number, estudioId: number) {
    const [row] = await db
      .select()
      .from(notasCaso)
      .where(and(eq(notasCaso.id, id), eq(notasCaso.estudioId, estudioId)))
      .limit(1);
    return row ?? null;
  }

  static async insertNotaCliente(data: Omit<NewNotaCliente, "estudioId">, estudioId: number) {
    const [row] = await db
      .insert(notasCliente)
      .values({ ...data, estudioId })
      .returning();

    return row;
  }

  static async insertNotaCaso(data: Omit<NewNotaCaso, "estudioId">, estudioId: number) {
    const [row] = await db
      .insert(notasCaso)
      .values({ ...data, estudioId })
      .returning();

    return row;
  }

  static async deleteNotaCliente(id: number, estudioId: number) {
    const [row] = await db
      .delete(notasCliente)
      .where(and(eq(notasCliente.id, id), eq(notasCliente.estudioId, estudioId)))
      .returning();

    return row ?? null;
  }

  static async deleteNotaCaso(id: number, estudioId: number) {
    const [row] = await db
      .delete(notasCaso)
      .where(and(
        eq(notasCaso.id, id),
        eq(notasCaso.estudioId, estudioId),
        exists(
          db
            .select({ id: casos.id })
            .from(casos)
            .where(and(
              eq(casos.id, notasCaso.casoId),
              eq(casos.estudioId, estudioId),
              isNull(casos.deletedAt),
            )),
        ),
      ))
      .returning();

    return row ?? null;
  }
}
