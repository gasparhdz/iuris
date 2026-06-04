import type { Readable } from "node:stream";

export type StorageKey = string;
export type StorageDriver = "google-drive" | "s3";

export interface StoredObject {
  key: StorageKey;
  name: string;
  mimeType: string;
  size: number | null;
  etag?: string | null;
  modifiedAt?: Date | null;
}

export interface StoredFolder {
  key: StorageKey;
  name: string;
}

export interface UploadStreamInput {
  body: Readable;
  name: string;
  mimeType: string;
  folderKey: StorageKey;
  size?: number;
}

export interface PresignedUploadInput {
  key: StorageKey;
  name: string;
  mimeType: string;
  size: number;
  folderKey?: StorageKey;
  expiresInSeconds?: number;
}

export interface PresignedUpload {
  key: StorageKey;
  url: string;
  method: "POST" | "PUT";
  fields?: Record<string, string>;
  headers?: Record<string, string>;
  expiresAt: Date;
}

export interface ConfirmUploadInput {
  key: StorageKey;
  expectedSize?: number;
  expectedMimeType?: string;
}

export interface TemporaryUrl {
  url: string;
  expiresAt: Date;
}

export interface WatchFolderInput {
  folderKey: StorageKey;
  callbackUrl: string;
  channelId: string;
  token: string;
  expiresAt?: Date;
}

export interface WatchFolderResult {
  channelId: string;
  resourceId?: string;
  pageToken?: string;
  expiresAt?: Date;
}

export interface StorageProvider {
  readonly driver: StorageDriver;

  createFolder(name: string, parentFolderKey?: StorageKey | null): Promise<StoredFolder>;
  findFolderByName(name: string, parentFolderKey: StorageKey): Promise<StoredFolder | null>;
  shareFolder?(folderKey: StorageKey, email: string, role: "writer" | "reader"): Promise<void>;
  listObjects(folderKey: StorageKey): Promise<StoredObject[]>;
  getObject(key: StorageKey): Promise<StoredObject>;
  deleteObject(key: StorageKey): Promise<void>;
  uploadStream(input: UploadStreamInput): Promise<StoredObject>;
  createPresignedUpload(input: PresignedUploadInput): Promise<PresignedUpload>;
  confirmUpload(input: ConfirmUploadInput): Promise<StoredObject>;
  getTemporaryDownloadUrl(key: StorageKey, expiresInSeconds?: number): Promise<TemporaryUrl>;
  watchFolder?(input: WatchFolderInput): Promise<WatchFolderResult>;
  stopWatch?(channelId: string, resourceId: string): Promise<void>;
}
