import type { FastifyReply, FastifyRequest } from "fastify";
import { consumeMemoryRateLimit } from "./auth-memory-rate-limit.js";

const AUTH_IP_MAX = 5;
const AUTH_IP_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_IP_MAX = 3;

/**
 * PreHandler fail-safe para /login y /register-tenant: límite por IP in-memory.
 * Complementa (y sustituye si Redis cae) el rate-limit de @fastify/rate-limit.
 */
export async function assertAuthIpRateLimit(request: FastifyRequest, reply: FastifyReply) {
  const key = `auth-ip:${request.ip}`;
  if (!consumeMemoryRateLimit(key, AUTH_IP_MAX, AUTH_IP_WINDOW_MS)) {
    return reply.status(429).send({
      error: { code: "RATE_LIMITED", message: "Demasiados intentos. Probá de nuevo en unos minutos." },
    });
  }
}

/** PreHandler fail-safe para /forgot-password (más estricto). */
export async function assertForgotPasswordIpRateLimit(request: FastifyRequest, reply: FastifyReply) {
  const key = `forgot-ip:${request.ip}`;
  if (!consumeMemoryRateLimit(key, FORGOT_IP_MAX, AUTH_IP_WINDOW_MS)) {
    return reply.status(429).send({
      error: { code: "RATE_LIMITED", message: "Demasiados intentos. Probá de nuevo en unos minutos." },
    });
  }
}
