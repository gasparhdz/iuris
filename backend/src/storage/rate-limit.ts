import PQueue from "p-queue";
import { env } from "../env.js";

const DEFAULT_RETRIES = 4;
const DEFAULT_BASE_DELAY_MS = 300;

export const storageQueue = new PQueue({
  concurrency: env.STORAGE_CONCURRENCY,
  intervalCap: env.STORAGE_INTERVAL_CAP,
  interval: env.STORAGE_INTERVAL_MS,
});

export async function queuedStorageCall<T>(operation: () => Promise<T>): Promise<T> {
  return storageQueue.add(() => withRetry(operation)) as Promise<T>;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: { retries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableStorageError(error)) break;
      await delay(backoffWithJitter(baseDelayMs, attempt));
    }
  }

  throw lastError;
}

export function isRetryableStorageError(error: unknown): boolean {
  const candidate = error as {
    code?: number;
    status?: number;
    response?: { status?: number; data?: unknown };
    errors?: Array<{ reason?: string }>;
  };

  const status = candidate.status ?? candidate.code ?? candidate.response?.status;
  if (status === 429 || (typeof status === "number" && status >= 500)) return true;
  if (status !== 403) return false;

  const reasons = [
    ...(candidate.errors?.map((item) => item.reason) ?? []),
    ...extractGoogleReasons(candidate.response?.data),
  ].filter(Boolean);

  return reasons.some((reason) => reason === "rateLimitExceeded" || reason === "userRateLimitExceeded");
}

function extractGoogleReasons(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const error = (data as { error?: { errors?: Array<{ reason?: string }>; reason?: string } }).error;
  return [
    ...(error?.errors?.map((item) => item.reason) ?? []),
    error?.reason,
  ].filter((reason): reason is string => Boolean(reason));
}

function backoffWithJitter(baseDelayMs: number, attempt: number): number {
  const exponential = baseDelayMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * baseDelayMs);
  return exponential + jitter;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
