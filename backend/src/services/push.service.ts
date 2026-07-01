import webpush from "web-push";
import type { FastifyBaseLogger } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { pushSubscriptions } from "../db/schema.js";
import { env } from "../env.js";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

const vapidConfigured = Boolean(
  env.VAPID_PUBLIC_KEY?.trim()
  && env.VAPID_PRIVATE_KEY?.trim()
  && env.VAPID_SUBJECT?.trim(),
);

if (vapidConfigured) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT!,
    env.VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );
}

function isExpiredSubscriptionError(statusCode?: number) {
  return statusCode === 404 || statusCode === 410;
}

export class PushService {
  static isEnabled(): boolean {
    return vapidConfigured;
  }

  static async saveSubscription(params: {
    estudioId: number;
    usuarioId: number;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  }) {
    const now = new Date();

    await db
      .insert(pushSubscriptions)
      .values({
        estudioId: params.estudioId,
        usuarioId: params.usuarioId,
        endpoint: params.endpoint,
        p256dh: params.p256dh,
        auth: params.auth,
        userAgent: params.userAgent?.slice(0, 255) ?? null,
        lastUsedAt: now,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          estudioId: params.estudioId,
          usuarioId: params.usuarioId,
          p256dh: params.p256dh,
          auth: params.auth,
          userAgent: params.userAgent?.slice(0, 255) ?? null,
          lastUsedAt: now,
        },
      });
  }

  static async deleteSubscription(endpoint: string, usuarioId: number) {
    await db
      .delete(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.usuarioId, usuarioId),
      ));
  }

  static async sendToUsuario(
    usuarioId: number,
    payload: PushPayload,
    logger: FastifyBaseLogger,
  ): Promise<void> {
    if (!PushService.isEnabled()) {
      return;
    }

    try {
      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.usuarioId, usuarioId));

      if (subscriptions.length === 0) {
        return;
      }

      const body = JSON.stringify(payload);

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            body,
          );

          await db
            .update(pushSubscriptions)
            .set({ lastUsedAt: new Date() })
            .where(eq(pushSubscriptions.id, sub.id));
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;

          if (isExpiredSubscriptionError(statusCode)) {
            await db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.id, sub.id));
            logger.info({ usuarioId, subscriptionId: sub.id }, "Suscripcion push expirada eliminada");
            continue;
          }

          logger.warn({ err: error, usuarioId, subscriptionId: sub.id }, "Error enviando push a suscripcion");
        }
      }
    } catch (error) {
      logger.error({ err: error, usuarioId }, "Error general enviando push al usuario");
    }
  }
}
