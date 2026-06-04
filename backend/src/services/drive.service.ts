import { env } from "../env.js";
import { AdjuntosQueries, type AdjuntoScope } from "../db/queries/adjuntos.queries.js";
import { DriveQueries } from "../db/queries/drive.queries.js";
import { getStorage } from "../storage/factory.js";
import { logger } from "../utils/logger.js";

export class DriveService {
  static async crearCarpetaCliente(clienteId: number, estudioId: number) {
    const cliente = await DriveQueries.findClienteById(clienteId, estudioId);
    if (!cliente) throw new Error("CLIENTE_NOT_FOUND");

    const rootId = await this.getEstudioRootFolder(estudioId);
    const nombreBase = formatClienteFolderName(cliente);
    const folder = await this.createUniqueFolder(nombreBase, rootId, estudioId);
    const updated = await DriveQueries.updateClienteDriveFolder(clienteId, estudioId, folder.key);
    if (!updated) throw new Error("CLIENTE_NOT_FOUND");
    return updated;
  }

  static async crearCarpetaCaso(casoId: number, estudioId: number) {
    const caso = await DriveQueries.findCasoById(casoId, estudioId);
    if (!caso) throw new Error("CASO_NOT_FOUND");

    let cliente = await DriveQueries.findClienteById(caso.clienteId, estudioId);
    if (!cliente) throw new Error("CLIENTE_NOT_FOUND");

    if (!cliente.driveFolderId) {
      cliente = await this.crearCarpetaCliente(cliente.id, estudioId);
    }

    const storage = getStorage(estudioId);
    const siblings = await storage.listObjects(cliente.driveFolderId ?? "");
    const folderCount = siblings.filter((file) => file.mimeType === "application/vnd.google-apps.folder").length;
    const numero = String(folderCount + 1).padStart(2, "0");
    const nombre = `${numero} - ${caso.caratula ?? "Expediente"}`;
    const folder = await storage.createFolder(nombre, cliente.driveFolderId);
    const updated = await DriveQueries.updateCasoDriveFolder(casoId, estudioId, folder.key);
    if (!updated) throw new Error("CASO_NOT_FOUND");
    return updated;
  }

  static async vincularCarpetaCliente(clienteId: number, estudioId: number, driveFolderId: string) {
    const updated = await DriveQueries.updateClienteDriveFolder(clienteId, estudioId, driveFolderId);
    if (!updated) throw new Error("CLIENTE_NOT_FOUND");
    return updated;
  }

  static async vincularCarpetaCaso(casoId: number, estudioId: number, driveFolderId: string) {
    const updated = await DriveQueries.updateCasoDriveFolder(casoId, estudioId, driveFolderId);
    if (!updated) throw new Error("CASO_NOT_FOUND");
    return updated;
  }

  static async resolveFolderForScope(scope: AdjuntoScope, scopeId: number, estudioId: number) {
    if (scope === "CLIENTE") {
      const cliente = await DriveQueries.findClienteById(scopeId, estudioId);
      if (!cliente) throw new Error("CLIENTE_NOT_FOUND");
      if (!cliente.driveFolderId) throw new Error("DRIVE_FOLDER_NOT_FOUND");
      return cliente.driveFolderId;
    }

    const caso = await DriveQueries.findCasoById(scopeId, estudioId);
    if (!caso) throw new Error("CASO_NOT_FOUND");
    if (!caso.driveFolderId) throw new Error("DRIVE_FOLDER_NOT_FOUND");
    return caso.driveFolderId;
  }

  static async indexarFolder(scope: AdjuntoScope, scopeId: number, estudioId: number) {
    const folderId = await this.resolveFolderForScope(scope, scopeId, estudioId);
    const storage = getStorage(estudioId);
    const [driveFiles, dbAdjuntos] = await Promise.all([
      storage.listObjects(folderId),
      AdjuntosQueries.findAdjuntosByScope(scope, scopeId, estudioId),
    ]);

    let creados = 0;
    let eliminados = 0;
    const dbByDriveId = new Set(dbAdjuntos.map((adjunto) => adjunto.driveFileId));
    const driveById = new Set(driveFiles.map((file) => file.key));

    for (const file of driveFiles) {
      if (!dbByDriveId.has(file.key) && file.mimeType !== "application/vnd.google-apps.folder") {
        await AdjuntosQueries.insertAdjunto({
          scope,
          scopeId,
          nombre: file.name,
          mime: file.mimeType,
          driveFileId: file.key,
          driveFolderId: folderId,
        }, estudioId);
        creados += 1;
      }
    }

    for (const adjunto of dbAdjuntos) {
      if (!driveById.has(adjunto.driveFileId)) {
        await AdjuntosQueries.softDeleteMissingFromFolder(estudioId, scope, scopeId, adjunto.driveFileId);
        eliminados += 1;
      }
    }

    return { creados, eliminados };
  }

  private static async getEstudioRootFolder(estudioId: number) {
    const estudio = await DriveQueries.findEstudioById(estudioId);
    if (!estudio) throw new Error("ESTUDIO_NOT_FOUND");
    if (estudio.driveFolderId) return estudio.driveFolderId;
    if (!env.DRIVE_ROOT_FOLDER_ID) throw new Error("DRIVE_ROOT_NOT_CONFIGURED");

    const storage = getStorage(estudioId);
    const folderName = `Estudio - ${estudio.nombre}`;
    const existing = await storage.findFolderByName(folderName, env.DRIVE_ROOT_FOLDER_ID);
    const folder = existing ?? await storage.createFolder(folderName, env.DRIVE_ROOT_FOLDER_ID);
    const adminEmail = await DriveQueries.findAdminEmail(estudioId);
    if (adminEmail && storage.shareFolder) {
      try {
        await storage.shareFolder(folder.key, adminEmail, "writer");
      } catch (err) {
        logger.error({ err }, `[DriveService] No se pudo compartir la carpeta del estudio ${estudioId}`);
      }
    }
    await DriveQueries.updateEstudioDriveFolder(estudioId, folder.key);
    return folder.key;
  }

  private static async createUniqueFolder(nombreBase: string, parentFolderId: string, estudioId: number) {
    const storage = getStorage(estudioId);
    let candidate = nombreBase;
    let counter = 2;
    while (await storage.findFolderByName(candidate, parentFolderId)) {
      candidate = `${nombreBase} (${counter})`;
      counter += 1;
    }
    return await storage.createFolder(candidate, parentFolderId);
  }
}

function formatClienteFolderName(cliente: { nombre: string | null; apellido: string | null; razonSocial: string | null }) {
  if (cliente.razonSocial) return cliente.razonSocial;
  return [cliente.apellido, cliente.nombre].filter(Boolean).join(", ") || "Cliente";
}
