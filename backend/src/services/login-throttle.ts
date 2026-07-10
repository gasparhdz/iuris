import { Redis } from "ioredis";
import { env } from "../env.js";

/**
 * Rate-limit de login POR CUENTA (complementa el límite por IP).
 *
 * Fail-safe: si Redis no responde, usa contador in-memory (nunca degrada a sin límite).
 */

const MAX_FAILED_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;
const WINDOW_MS = WINDOW_SECONDS * 1000;

type MemoryEntry = { count: number; resetAt: number };
const memoryCounts = new Map<string, MemoryEntry>();

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  connectTimeout: 500,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
});
redis.on("error", () => {
  // Silencioso: el fallback in-memory se maneja en cada operación.
});

function redisKey(email: string): string {
  return `login-throttle:${email.trim().toLowerCase()}`;
}

function memoryKey(email: string): string {
  return email.trim().toLowerCase();
}

function memoryGet(email: string): number {
  const entry = memoryCounts.get(memoryKey(email));
  if (!entry || entry.resetAt <= Date.now()) return 0;
  return entry.count;
}

function memoryIncr(email: string): number {
  const key = memoryKey(email);
  const now = Date.now();
  const entry = memoryCounts.get(key);
  if (!entry || entry.resetAt <= now) {
    memoryCounts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

function memoryClear(email: string) {
  memoryCounts.delete(memoryKey(email));
}

/** Lanza ACCOUNT_LOCKED si la cuenta superó el máximo de intentos fallidos en la ventana. */
export async function assertAccountNotLocked(email: string): Promise<void> {
  try {
    const count = await redis.get(redisKey(email));
    if (count !== null && Number(count) >= MAX_FAILED_ATTEMPTS) {
      throw new Error("ACCOUNT_LOCKED");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_LOCKED") throw error;
    if (memoryGet(email) >= MAX_FAILED_ATTEMPTS) {
      throw new Error("ACCOUNT_LOCKED");
    }
  }
}

/** Registra un intento fallido. El primer fallo de la ventana fija el TTL. */
export async function registerFailedLogin(email: string): Promise<void> {
  try {
    const key = redisKey(email);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SECONDS);
  } catch {
    memoryIncr(email);
  }
}

/** Limpia el contador tras un login exitoso. */
export async function clearLoginThrottle(email: string): Promise<void> {
  try {
    await redis.del(redisKey(email));
  } catch {
    // ignore redis
  }
  memoryClear(email);
}

export async function closeLoginThrottle(): Promise<void> {
  await redis.quit().catch(() => {});
}

/** Solo tests. */
export function clearLoginThrottleMemoryForTests() {
  memoryCounts.clear();
}
