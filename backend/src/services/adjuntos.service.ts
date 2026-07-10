import path from "node:path";
import { Readable } from "node:stream";
import { AdjuntosQueries, type AdjuntoScope } from "../db/queries/adjuntos.queries.js";
import { getStorage } from "../storage/factory.js";
import { buildAdjuntoKey } from "../storage/providers/s3.provider.js";
import { serializeDates } from "../utils/serialize.js";
import { DriveService } from "./drive.service.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".docx", ".xlsx", ".zip"]);

export class AdjuntosService {
  static async findAdjuntos(scope: AdjuntoScope, scopeId: number, estudioId: number) {
    await this.ensureScopeParent(scope, scopeId, estudioId);
    const adjuntos = await AdjuntosQueries.findAdjuntosByScope(scope, scopeId, estudioId);
    return serializeDates(adjuntos);
  }

  static async uploadAdjunto(input: {
    scope: AdjuntoScope;
    scopeId: number;
    estudioId: number;
    fileBuffer: Buffer;
    nombre: string;
    mimeType: string;
  }) {
    validateFile(input.nombre, input.fileBuffer.length);
    return this.uploadAdjuntoStream({
      ...input,
      fileStream: ReadableFromBuffer(input.fileBuffer),
      size: input.fileBuffer.length,
    });
  }

  static async uploadAdjuntoStream(input: {
    scope: AdjuntoScope;
    scopeId: number;
    estudioId: number;
    fileStream: Readable;
    nombre: string;
    mimeType: string;
    size?: number;
  }) {
    validateFile(input.nombre, input.size);
    await this.ensureScopeParent(input.scope, input.scopeId, input.estudioId);
    const folderId = await DriveService.resolveFolderForScope(input.scope, input.scopeId, input.estudioId);
    const storage = getStorage(input.estudioId);
    const uploaded = await storage.uploadStream({
      body: input.fileStream,
      name: input.nombre,
      mimeType: input.mimeType,
      folderKey: folderId,
      size: input.size,
    });
    // @fastify/multipart trunca el stream al llegar al limite en vez de fallar:
    // si quedo truncado, el objeto subido esta incompleto -> borrar y rechazar.
    if ((input.fileStream as Readable & { truncated?: boolean }).truncated) {
      await storage.deleteObject(uploaded.key).catch(() => undefined);
      throw new Error("FILE_TOO_LARGE");
    }
    const adjunto = await AdjuntosQueries.insertAdjunto({
      scope: input.scope,
      scopeId: input.scopeId,
      nombre: uploaded.name,
      mime: uploaded.mimeType,
      driveFileId: uploaded.key,
      driveFolderId: folderId,
      storageDriver: storage.driver,
      etag: uploaded.etag,
    }, input.estudioId);
    return serializeDates(adjunto);
  }

  static async createPresignedUpload(input: {
    scope: AdjuntoScope;
    scopeId: number;
    estudioId: number;
    nombre: string;
    mimeType: string;
    size: number;
  }) {
    validateFile(input.nombre, input.size);
    const storage = getStorage(input.estudioId);
    if (storage.driver !== "s3") throw new Error("PRESIGNED_UPLOAD_NOT_SUPPORTED");

    await this.ensureScopeParent(input.scope, input.scopeId, input.estudioId);
    await DriveService.resolveFolderForScope(input.scope, input.scopeId, input.estudioId);
    const key = buildAdjuntoKey(input.estudioId, input.scope, input.scopeId, input.nombre);
    const presigned = await storage.createPresignedUpload({
      key,
      name: input.nombre,
      mimeType: input.mimeType,
      size: input.size,
      expiresInSeconds: 300,
    });
    return { ...presigned, expiresAt: presigned.expiresAt.toISOString() };
  }

  static async confirmPresignedUpload(input: {
    scope: AdjuntoScope;
    scopeId: number;
    estudioId: number;
    key: string;
    nombre: string;
    mimeType: string;
    size: number;
  }) {
    validateFile(input.nombre, input.size);
    assertEstudioPrefix(input.key, input.estudioId);
    await this.ensureScopeParent(input.scope, input.scopeId, input.estudioId);
    const folderId = await DriveService.resolveFolderForScope(input.scope, input.scopeId, input.estudioId);
    const storage = getStorage(input.estudioId);
    const object = await storage.confirmUpload({
      key: input.key,
      expectedSize: input.size,
      expectedMimeType: input.mimeType,
    });
    const adjunto = await AdjuntosQueries.insertAdjunto({
      scope: input.scope,
      scopeId: input.scopeId,
      nombre: input.nombre,
      mime: object.mimeType,
      driveFileId: object.key,
      driveFolderId: folderId,
      storageDriver: storage.driver,
      etag: object.etag,
    }, input.estudioId);
    return serializeDates(adjunto);
  }

  static async deleteAdjunto(id: number, estudioId: number) {
    const adjunto = await AdjuntosQueries.findAdjuntoById(id, estudioId);
    if (!adjunto) throw new Error("ADJUNTO_NOT_FOUND");
    await this.ensureScopeParent(adjunto.scope as AdjuntoScope, adjunto.scopeId, estudioId);
    const storage = getStorage(estudioId);
    await storage.deleteObject(adjunto.driveFileId);
    await AdjuntosQueries.softDeleteAdjunto(id, estudioId);
  }

  static async indexarAdjuntos(scope: AdjuntoScope, scopeId: number, estudioId: number) {
    await this.ensureScopeParent(scope, scopeId, estudioId);
    return await DriveService.indexarFolder(scope, scopeId, estudioId);
  }

  private static async ensureScopeParent(scope: AdjuntoScope, scopeId: number, estudioId: number) {
    if (scope !== "CASO") return;
    const caso = await AdjuntosQueries.ensureCasoVivo(scopeId, estudioId);
    if (!caso) throw new Error("CASO_NOT_FOUND");
  }
}

function validateFile(nombre: string, size?: number) {
  const ext = path.extname(nombre).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error("INVALID_FILE_EXTENSION");
  if (size !== undefined && size > MAX_FILE_SIZE) throw new Error("FILE_TOO_LARGE");
}

function assertEstudioPrefix(key: string, estudioId: number) {
  if (!key.startsWith(`estudios/${estudioId}/`)) throw new Error("INVALID_STORAGE_KEY");
}

function ReadableFromBuffer(buffer: Buffer): Readable {
  return Readable.from(buffer);
}
