import { and, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "../index.js";
import { casos, clientes, estudios, storageWatches, usuarios } from "../schema.js";

export class DriveQueries {
  static async findEstudioById(estudioId: number) {
    const [row] = await db.select().from(estudios).where(eq(estudios.id, estudioId)).limit(1);
    return row ?? null;
  }

  static async findAdminEmail(estudioId: number) {
    const [row] = await db
      .select({ email: usuarios.email })
      .from(usuarios)
      .where(and(eq(usuarios.estudioId, estudioId), isNull(usuarios.deletedAt), eq(usuarios.activo, true)))
      .limit(1);
    return row?.email ?? null;
  }

  static async updateEstudioDriveFolder(estudioId: number, driveFolderId: string) {
    const [row] = await db.update(estudios).set({ driveFolderId }).where(eq(estudios.id, estudioId)).returning();
    return row ?? null;
  }

  static async findClienteById(id: number, estudioId: number) {
    const [row] = await db
      .select()
      .from(clientes)
      .where(and(eq(clientes.id, id), eq(clientes.estudioId, estudioId), isNull(clientes.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  static async updateClienteDriveFolder(id: number, estudioId: number, driveFolderId: string) {
    const [row] = await db
      .update(clientes)
      .set({ driveFolderId })
      .where(and(eq(clientes.id, id), eq(clientes.estudioId, estudioId), isNull(clientes.deletedAt)))
      .returning();
    return row ?? null;
  }

  static async findCasoById(id: number, estudioId: number) {
    const [row] = await db
      .select()
      .from(casos)
      .where(and(eq(casos.id, id), eq(casos.estudioId, estudioId), isNull(casos.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  static async updateCasoDriveFolder(id: number, estudioId: number, driveFolderId: string) {
    const [row] = await db
      .update(casos)
      .set({ driveFolderId })
      .where(and(eq(casos.id, id), eq(casos.estudioId, estudioId), isNull(casos.deletedAt)))
      .returning();
    return row ?? null;
  }

  static async findScopesWithFolders(estudioId: number) {
    const clienteRows = await db
      .select({ scopeId: clientes.id, folderKey: clientes.driveFolderId })
      .from(clientes)
      .where(and(eq(clientes.estudioId, estudioId), isNull(clientes.deletedAt), isNotNull(clientes.driveFolderId)));

    const casoRows = await db
      .select({ scopeId: casos.id, folderKey: casos.driveFolderId })
      .from(casos)
      .where(and(eq(casos.estudioId, estudioId), isNull(casos.deletedAt), isNotNull(casos.driveFolderId)));

    return [
      ...clienteRows.filter((row) => row.folderKey).map((row) => ({ scope: "CLIENTE" as const, scopeId: row.scopeId })),
      ...casoRows.filter((row) => row.folderKey).map((row) => ({ scope: "CASO" as const, scopeId: row.scopeId })),
    ];
  }

  static async findWatchByChannelId(channelId: string) {
    const [row] = await db.select().from(storageWatches).where(eq(storageWatches.channelId, channelId)).limit(1);
    return row ?? null;
  }

  static async findWatchesToRenew(before: Date) {
    return await db.select().from(storageWatches).where(and(eq(storageWatches.storageDriver, "google-drive"), lt(storageWatches.expiresAt, before)));
  }

  static async upsertStorageWatch(data: typeof storageWatches.$inferInsert) {
    const [row] = await db
      .insert(storageWatches)
      .values(data)
      .onConflictDoUpdate({
        target: storageWatches.channelId,
        set: {
          resourceId: data.resourceId,
          pageToken: data.pageToken,
          expiresAt: data.expiresAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }
}
