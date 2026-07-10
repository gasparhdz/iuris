import crypto from "node:crypto";
import { Redis } from "ioredis";
import { env } from "../env.js";

/**
 * Tickets SSE efímeros de un solo uso.
 * Evitan poner el access JWT en la querystring del EventSource (logs/proxies/Referer).
 *
 * En test usa store en memoria (sin Redis). En runtime usa Redis con TTL.
 */

export const SSE_TICKET_TTL_SEC = 60;
const KEY_PREFIX = "sse-ticket:";

export type SseTicketPayload = {
  usuarioId: number;
  estudioId: number;
  tokenVersion: number;
};

type MemoryEntry = {
  payload: SseTicketPayload;
  expiresAt: number;
};

const memoryStore = new Map<string, MemoryEntry>();

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  connectTimeout: 500,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
});
redis.on("error", () => {
  // Fail-closed en issue/consume: si Redis no responde, no se emiten tickets.
});

function useMemoryStore() {
  // Vitest setea VITEST=true; en test no dependemos de Redis.
  return env.NODE_ENV === "test" || process.env.VITEST === "true";
}

function redisKey(ticket: string) {
  return `${KEY_PREFIX}${ticket}`;
}

export async function issueSseTicket(payload: SseTicketPayload): Promise<{ ticket: string; expiresIn: number }> {
  const ticket = crypto.randomBytes(32).toString("hex");

  if (useMemoryStore()) {
    memoryStore.set(ticket, {
      payload,
      expiresAt: Date.now() + SSE_TICKET_TTL_SEC * 1000,
    });
    return { ticket, expiresIn: SSE_TICKET_TTL_SEC };
  }

  try {
    await redis.set(redisKey(ticket), JSON.stringify(payload), "EX", SSE_TICKET_TTL_SEC);
  } catch {
    throw new Error("SSE_TICKET_STORE_UNAVAILABLE");
  }

  return { ticket, expiresIn: SSE_TICKET_TTL_SEC };
}

/** Consume el ticket (un solo uso). Devuelve null si es inválido, expirado o ya usado. */
export async function consumeSseTicket(ticket: string): Promise<SseTicketPayload | null> {
  if (!ticket || typeof ticket !== "string") return null;

  if (useMemoryStore()) {
    const entry = memoryStore.get(ticket);
    memoryStore.delete(ticket);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.payload;
  }

  try {
    const key = redisKey(ticket);
    const raw = await redis.getdel(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SseTicketPayload;
    if (
      typeof parsed.usuarioId !== "number"
      || typeof parsed.estudioId !== "number"
      || typeof parsed.tokenVersion !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Solo para tests: limpia el store en memoria. */
export function clearSseTicketMemoryStoreForTests() {
  memoryStore.clear();
}
