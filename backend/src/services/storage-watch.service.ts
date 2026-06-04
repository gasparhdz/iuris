import crypto from "node:crypto";
import cron from "node-cron";
import { env } from "../env.js";
import { DriveQueries } from "../db/queries/drive.queries.js";
import { getStorage } from "../storage/factory.js";
import { logger } from "../utils/logger.js";
import { DriveService } from "./drive.service.js";

const log = logger.child({ module: "StorageWatch" });
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;

export class StorageWatchService {
  static async handleDriveWebhook(headers: Record<string, string | string[] | undefined>) {
    const channelId = headerValue(headers["x-goog-channel-id"]);
    const channelToken = headerValue(headers["x-goog-channel-token"]);
    const resourceState = headerValue(headers["x-goog-resource-state"]);
    if (!channelId || !channelToken) throw new Error("INVALID_WEBHOOK");

    const watch = await DriveQueries.findWatchByChannelId(channelId);
    if (!watch) throw new Error("WATCH_NOT_FOUND");
    if (!verifyToken(watch.estudioId, channelId, channelToken)) throw new Error("INVALID_WEBHOOK_TOKEN");
    if (resourceState === "sync") return;

    setImmediate(() => {
      this.reconcileEstudio(watch.estudioId).catch((error) => {
        log.error({ err: error, estudioId: watch.estudioId }, "No se pudo reconciliar cambios de storage");
      });
    });
  }

  static async ensureDriveWatch(estudioId: number) {
    if (!env.STORAGE_WEBHOOK_SECRET || !env.STORAGE_WEBHOOK_BASE_URL) {
      throw new Error("STORAGE_WEBHOOK_NOT_CONFIGURED");
    }

    const storage = getStorage(estudioId);
    if (!storage.watchFolder) throw new Error("WATCH_NOT_SUPPORTED");

    const channelId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    const result = await storage.watchFolder({
      folderKey: `estudios/${estudioId}`,
      callbackUrl: `${env.STORAGE_WEBHOOK_BASE_URL.replace(/\/$/, "")}/api/v1/webhooks/drive`,
      channelId,
      token: signToken(estudioId, channelId),
      expiresAt,
    });

    return DriveQueries.upsertStorageWatch({
      estudioId,
      storageDriver: storage.driver,
      channelId: result.channelId,
      resourceId: result.resourceId,
      pageToken: result.pageToken,
      expiresAt: result.expiresAt,
    });
  }

  static async renewExpiringWatches() {
    if (!env.STORAGE_WEBHOOK_SECRET || !env.STORAGE_WEBHOOK_BASE_URL) return;
    const threshold = new Date(Date.now() + RENEW_BEFORE_MS);
    const watches = await DriveQueries.findWatchesToRenew(threshold);

    for (const watch of watches) {
      try {
        const storage = getStorage(watch.estudioId);
        if (watch.resourceId && storage.stopWatch) {
          await storage.stopWatch(watch.channelId, watch.resourceId).catch((error) => {
            log.warn({ err: error, channelId: watch.channelId }, "No se pudo cancelar watch anterior");
          });
        }
        await this.ensureDriveWatch(watch.estudioId);
      } catch (error) {
        log.error({ err: error, estudioId: watch.estudioId }, "No se pudo renovar watch de Drive");
      }
    }
  }

  static async reconcileEstudio(estudioId: number) {
    const scopes = await DriveQueries.findScopesWithFolders(estudioId);
    for (const scope of scopes) {
      await DriveService.indexarFolder(scope.scope, scope.scopeId, estudioId);
    }
  }
}

export function iniciarCronStorageWatch() {
  cron.schedule("0 * * * *", () => {
    StorageWatchService.renewExpiringWatches().catch((error) => {
      log.error({ err: error }, "No se pudo renovar watches de storage");
    });
  });

  cron.schedule("0 3 * * *", async () => {
    const watches = await DriveQueries.findWatchesToRenew(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
    const estudios = new Set(watches.map((watch) => watch.estudioId));
    for (const estudioId of estudios) {
      await StorageWatchService.reconcileEstudio(estudioId).catch((error) => {
        log.error({ err: error, estudioId }, "No se pudo ejecutar reconciliacion nocturna");
      });
    }
  });
}

function signToken(estudioId: number, channelId: string) {
  return crypto
    .createHmac("sha256", env.STORAGE_WEBHOOK_SECRET ?? "")
    .update(`${estudioId}:${channelId}`)
    .digest("hex");
}

function verifyToken(estudioId: number, channelId: string, token: string) {
  const expected = signToken(estudioId, channelId);
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);
  return expectedBuffer.length === tokenBuffer.length && crypto.timingSafeEqual(expectedBuffer, tokenBuffer);
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
