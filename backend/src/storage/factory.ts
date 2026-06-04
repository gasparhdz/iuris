import { env } from "../env.js";
import { GoogleDriveProvider } from "./providers/drive.provider.js";
import { S3Provider } from "./providers/s3.provider.js";
import type { StorageProvider } from "./types.js";

const providers = new Map<number, StorageProvider>();

export function getStorage(estudioId: number): StorageProvider {
  const cached = providers.get(estudioId);
  if (cached) return cached;

  const provider = env.STORAGE_DRIVER === "s3"
    ? new S3Provider(estudioId)
    : new GoogleDriveProvider(estudioId);
  providers.set(estudioId, provider);
  return provider;
}
