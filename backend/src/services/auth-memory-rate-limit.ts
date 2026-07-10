/**
 * Rate-limit in-memory para endpoints de auth cuando Redis no está disponible.
 * Fail-safe: nunca degrada a "sin límite" en /login y /forgot-password.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Limpia entradas vencidas de vez en cuando para no crecer sin cota. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Incrementa el contador de la clave. Devuelve true si está dentro del límite,
 * false si debe rechazarse (429).
 */
export function consumeMemoryRateLimit(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= max) return false;
  existing.count += 1;
  return true;
}

export function clearMemoryRateLimitForTests() {
  buckets.clear();
}
