import { Redis } from "ioredis";
import { env } from "../env.js";

/**
 * Rate-limit de login POR CUENTA (complementa el límite por IP de @fastify/rate-limit).
 * El límite por IP no frena un ataque distribuido (botnet) contra una sola cuenta; este
 * cuenta los intentos fallidos por email y bloquea temporalmente tras N fallos.
 *
 * Fail-open: si Redis no responde, no bloquea el login (degrada a "sin límite por cuenta"),
 * igual criterio que el store de rate-limit por IP en server.ts. Nunca debe dejar afuera a
 * un usuario legítimo por una caída de Redis.
 *
 * El contador vive en una ventana deslizante: el primer fallo fija el TTL; al alcanzar el
 * máximo, la cuenta queda bloqueada hasta que la ventana expira (no se extiende con cada
 * intento bloqueado, así se auto-desbloquea). Un login exitoso limpia el contador.
 */

const MAX_FAILED_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  connectTimeout: 500,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
});
redis.on("error", () => {
  // Silencioso: el fail-open se maneja en cada operación. Evitamos ruido de logs por
  // reconexión (server.ts ya loguea la indisponibilidad del Redis de rate-limit).
});

function keyFor(email: string): string {
  return `login-throttle:${email.trim().toLowerCase()}`;
}

/** Lanza ACCOUNT_LOCKED si la cuenta superó el máximo de intentos fallidos en la ventana. */
export async function assertAccountNotLocked(email: string): Promise<void> {
  let count: string | null;
  try {
    count = await redis.get(keyFor(email));
  } catch {
    return; // fail-open
  }
  if (count !== null && Number(count) >= MAX_FAILED_ATTEMPTS) {
    throw new Error("ACCOUNT_LOCKED");
  }
}

/** Registra un intento fallido. El primer fallo de la ventana fija el TTL. */
export async function registerFailedLogin(email: string): Promise<void> {
  try {
    const key = keyFor(email);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SECONDS);
  } catch {
    // fail-open: si no podemos contar, no rompemos el login
  }
}

/** Limpia el contador tras un login exitoso. */
export async function clearLoginThrottle(email: string): Promise<void> {
  try {
    await redis.del(keyFor(email));
  } catch {
    // ignore
  }
}

export async function closeLoginThrottle(): Promise<void> {
  await redis.quit().catch(() => {});
}
