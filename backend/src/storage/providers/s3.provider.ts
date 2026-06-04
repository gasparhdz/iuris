import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../env.js";
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
} from "../types.js";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export class S3Provider implements StorageProvider {
  readonly driver = "s3" as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(readonly estudioId: number) {
    this.bucket = env.S3_BUCKET ?? "";
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
  }

  async createFolder(name: string, parentFolderKey?: StorageKey | null): Promise<StoredFolder> {
    const key = normalizePrefix(`${parentFolderKey ?? estudioPrefix(this.estudioId)}${safeSegment(name)}/`);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: "" }));
    return { key, name };
  }

  async findFolderByName(name: string, parentFolderKey: StorageKey): Promise<StoredFolder | null> {
    const key = normalizePrefix(`${parentFolderKey}${safeSegment(name)}/`);
    const response = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: key, MaxKeys: 1 }));
    return response.Contents?.length ? { key, name } : null;
  }

  async listObjects(folderKey: StorageKey): Promise<StoredObject[]> {
    const response = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: normalizePrefix(folderKey) }));
    return (response.Contents ?? [])
      .filter((item) => item.Key && item.Key !== folderKey && !item.Key.endsWith("/"))
      .map((item) => ({
        key: item.Key ?? "",
        name: basename(item.Key ?? ""),
        mimeType: "application/octet-stream",
        size: item.Size ?? null,
        etag: item.ETag?.replaceAll("\"", "") ?? null,
        modifiedAt: item.LastModified ?? null,
      }));
  }

  async getObject(key: StorageKey): Promise<StoredObject> {
    const response = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return {
      key,
      name: basename(key),
      mimeType: response.ContentType ?? "application/octet-stream",
      size: response.ContentLength ?? null,
      etag: response.ETag?.replaceAll("\"", "") ?? null,
      modifiedAt: response.LastModified ?? null,
    };
  }

  async deleteObject(key: StorageKey): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async uploadStream(input: UploadStreamInput): Promise<StoredObject> {
    const key = normalizeKey(`${input.folderKey}${safeSegment(input.name)}`);

    // Tope de seguridad: aborta el stream si supera el maximo permitido,
    // incluso cuando el tamano no se conoce de antemano.
    let bytes = 0;
    input.body.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_UPLOAD_BYTES) {
        input.body.destroy(new Error("FILE_TOO_LARGE"));
      }
    });

    // Upload (lib-storage) sube por multipart en chunks, sin necesidad de
    // conocer ContentLength: soporta streams de tamano desconocido.
    const uploader = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.mimeType,
      },
    });
    await uploader.done();
    return this.getObject(key);
  }

  async createPresignedUpload(input: PresignedUploadInput): Promise<PresignedUpload> {
    assertEstudioKey(input.key, this.estudioId);
    const expiresInSeconds = input.expiresInSeconds ?? 300;
    const result = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: input.key,
      Expires: expiresInSeconds,
      Conditions: [
        ["content-length-range", input.size, input.size],
        ["starts-with", "$key", estudioPrefix(this.estudioId)],
        ["eq", "$Content-Type", input.mimeType],
      ],
      Fields: {
        "Content-Type": input.mimeType,
      },
    });

    return {
      key: input.key,
      url: result.url,
      method: "POST",
      fields: result.fields,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async confirmUpload(input: ConfirmUploadInput): Promise<StoredObject> {
    assertEstudioKey(input.key, this.estudioId);
    const object = await this.getObject(input.key);
    if (input.expectedSize !== undefined && object.size !== input.expectedSize) throw new Error("FILE_SIZE_MISMATCH");
    if (input.expectedMimeType && object.mimeType !== input.expectedMimeType) throw new Error("MIME_TYPE_MISMATCH");
    return object;
  }

  async getTemporaryDownloadUrl(key: StorageKey, expiresInSeconds = 300): Promise<TemporaryUrl> {
    assertEstudioKey(key, this.estudioId);
    const url = await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSeconds });
    return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
  }
}

export function buildAdjuntoKey(estudioId: number, scope: string, scopeId: number, fileName: string): StorageKey {
  return normalizeKey(`${estudioPrefix(estudioId)}adjuntos/${scope.toLowerCase()}/${scopeId}/${Date.now()}-${safeSegment(fileName)}`);
}

function estudioPrefix(estudioId: number) {
  return `estudios/${estudioId}/`;
}

function normalizePrefix(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(value: string) {
  return value.replace(/\/+/g, "/");
}

function safeSegment(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").trim() || "archivo";
}

function basename(key: string) {
  return key.split("/").filter(Boolean).at(-1) ?? key;
}

function assertEstudioKey(key: string, estudioId: number) {
  if (!key.startsWith(estudioPrefix(estudioId))) throw new Error("INVALID_STORAGE_KEY");
}
