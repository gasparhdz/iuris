import {
  buscarCarpetaPorNombre,
  compartirCarpeta,
  crearCarpeta,
  eliminarArchivo,
  listarArchivos,
  obtenerArchivo,
  subirArchivoStream,
  getDriveClient,
  type DriveFile,
} from "../../utils/drive.js";
import { queuedStorageCall } from "../rate-limit.js";
import type {
  ConfirmUploadInput,
  PresignedUpload,
  PresignedUploadInput,
  StorageKey,
  StorageProvider,
  StoredFolder,
  StoredObject,
  TemporaryUrl,
  UploadStreamInput,
  WatchFolderInput,
  WatchFolderResult,
} from "../types.js";

export class GoogleDriveProvider implements StorageProvider {
  readonly driver = "google-drive" as const;

  constructor(readonly estudioId: number) {}

  async createFolder(name: string, parentFolderKey?: StorageKey | null): Promise<StoredFolder> {
    const folder = await queuedStorageCall(() => crearCarpeta(name, parentFolderKey));
    return { key: folder.id, name: folder.name };
  }

  async findFolderByName(name: string, parentFolderKey: StorageKey): Promise<StoredFolder | null> {
    const folder = await queuedStorageCall(() => buscarCarpetaPorNombre(name, parentFolderKey));
    return folder ? { key: folder.id, name: folder.name } : null;
  }

  async shareFolder(folderKey: StorageKey, email: string, role: "writer" | "reader"): Promise<void> {
    await queuedStorageCall(() => compartirCarpeta(folderKey, email, role));
  }

  async listObjects(folderKey: StorageKey): Promise<StoredObject[]> {
    const files = await queuedStorageCall(() => listarArchivos(folderKey));
    return files.map(toStoredObject);
  }

  async getObject(key: StorageKey): Promise<StoredObject> {
    return toStoredObject(await queuedStorageCall(() => obtenerArchivo(key)));
  }

  async deleteObject(key: StorageKey): Promise<void> {
    await queuedStorageCall(() => eliminarArchivo(key));
  }

  async uploadStream(input: UploadStreamInput): Promise<StoredObject> {
    return toStoredObject(await queuedStorageCall(() => subirArchivoStream(input.body, input.name, input.mimeType, input.folderKey)));
  }

  async createPresignedUpload(_input: PresignedUploadInput): Promise<PresignedUpload> {
    throw new Error("PRESIGNED_UPLOAD_NOT_SUPPORTED");
  }

  async confirmUpload(input: ConfirmUploadInput): Promise<StoredObject> {
    return this.getObject(input.key);
  }

  async getTemporaryDownloadUrl(key: StorageKey): Promise<TemporaryUrl> {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    return { url: `https://drive.google.com/file/d/${encodeURIComponent(key)}/view`, expiresAt };
  }

  async watchFolder(input: WatchFolderInput): Promise<WatchFolderResult> {
    const drive = getDriveClient();
    const pageToken = await queuedStorageCall(async () => {
      const response = await drive.changes.getStartPageToken();
      return response.data.startPageToken ?? undefined;
    });
    const response = await queuedStorageCall(() => drive.changes.watch({
      pageToken: pageToken ?? "1",
      requestBody: {
        id: input.channelId,
        type: "web_hook",
        address: input.callbackUrl,
        token: input.token,
        expiration: input.expiresAt ? String(input.expiresAt.getTime()) : undefined,
      },
    }));

    return {
      channelId: input.channelId,
      resourceId: response.data.resourceId ?? undefined,
      pageToken,
      expiresAt: response.data.expiration ? new Date(Number(response.data.expiration)) : input.expiresAt,
    };
  }

  async stopWatch(channelId: string, resourceId: string): Promise<void> {
    const drive = getDriveClient();
    await queuedStorageCall(() => drive.channels.stop({ requestBody: { id: channelId, resourceId } }));
  }
}

function toStoredObject(file: DriveFile): StoredObject {
  return {
    key: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : null,
  };
}
