import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  deleteSession,
  getStatus,
  isSyncRunning,
  mergeSessionCookie,
  saveSession,
  verifySesionActiva,
  iniciarLoginInteractivo,
  tryClaimSync,
  updateSyncStatus,
} from "../services/sisfe-session.service.js";
import { enqueueSisfeSync, SisfeSyncAlreadyRunningError } from "../queue/sisfe.queue.js";
import { SecurityAuditService } from "../services/security-audit.service.js";
import { env } from "../env.js";

const SISFE_BASE_URL = "https://sisfe.justiciasantafe.gov.ar";
const SISFE_ORIGIN = new URL(SISFE_BASE_URL).origin;
const APP_SISFE_PREFIX = "/api/sisfe";
const PROXY_COOKIE_NAME = "sisfe_proxy_auth";
const PROXY_COOKIE_MAX_AGE_SEC = 15 * 60; // token efímero de corta vida (15 min)

/** Path tras /proxy inseguro (SSRF): protocol-relative, absoluto o backslash. */
export function isUnsafeProxyPath(pathAndQuery: string): boolean {
  const pathOnly = pathAndQuery.split("?")[0] ?? "";
  return pathOnly.includes("//") || pathOnly.includes("://") || pathOnly.includes("\\");
}

/** Solo se permite fetch al origen oficial de SISFE. */
export function isAllowedSisfeTarget(targetUrl: URL): boolean {
  return targetUrl.origin === SISFE_ORIGIN;
}

/**
 * Resuelve el destino del proxy o null si es SSRF / path inválido.
 * Exportado para tests unitarios.
 */
export function resolveSafeProxyTarget(proxiedPath: string): URL | null {
  if (isUnsafeProxyPath(proxiedPath)) return null;
  try {
    const targetUrl = new URL(proxiedPath, SISFE_BASE_URL);
    if (!isAllowedSisfeTarget(targetUrl)) return null;
    return targetUrl;
  } catch {
    return null;
  }
}

/**
 * Reescribe Location solo si apunta a SISFE (relativo o absoluto del mismo origin).
 * Devuelve null si el Location sería un open-redirect / SSRF vía redirect.
 */
export function rewriteLocationSafe(location: string): string | null {
  const trimmed = location.trim();
  if (!trimmed || trimmed.includes("\\") || trimmed.startsWith("//")) return null;

  if (trimmed.includes("://")) {
    try {
      const absolute = new URL(trimmed);
      if (absolute.origin !== SISFE_ORIGIN) return null;
      return `${APP_SISFE_PREFIX}/proxy${absolute.pathname}${absolute.search}`;
    } catch {
      return null;
    }
  }

  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (isUnsafeProxyPath(path)) return null;
  return `${APP_SISFE_PREFIX}/proxy${path}`;
}

type ProxyQuery = {
  /** @deprecated No usar JWT de la app en querystring. */
  sisfeToken?: string;
  token?: string;
};

type ManualSessionBody = {
  cookieName?: string;
  cookieValue?: string;
};

const manualSessionSchema = z.object({
  cookieName: z.string().trim().min(1).max(100),
  cookieValue: z.string().trim().min(1),
}).strict();

export const sisfeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    done(null, body);
  });

  fastify.get("/auth/success", async (_request, reply) => {
    const targetOrigin = JSON.stringify(env.APP_URL);
    return reply.type("text/html").send(`<!DOCTYPE html><html><body>
<script>if(window.opener){window.opener.postMessage({event:'SISFE_LOGIN_OK'},${targetOrigin})}window.close()</script>
<p>Autenticación exitosa. Puede cerrar esta ventana.</p>
</body></html>`);
  });

  fastify.post("/auth/session", {
    preHandler: [fastify.authenticate, fastify.authorize("CASOS", "editar")],
  }, async (request: FastifyRequest<{ Body: ManualSessionBody }>, reply) => {
    const parsed = manualSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_BODY", message: "Cookie inválida" } });
    }

    const activa = await verifySesionActiva(parsed.data.cookieName, parsed.data.cookieValue);
    if (!activa) {
      return reply.status(400).send({ error: { code: "SISFE_SESSION_INVALID", message: "La cookie no permite acceder al portal SISFE" } });
    }

    await saveSession(request.authUser.id, request.authUser.estudioId, parsed.data.cookieName, parsed.data.cookieValue);
    await SecurityAuditService.log({
      evento: "SISFE_CONNECT",
      request,
      statusCode: 200,
      metadata: { mode: "manual" },
    });
    return reply.send({ data: { message: "Sesión SISFE guardada" } });
  });

  fastify.delete("/auth/session", {
    preHandler: [fastify.authenticate, fastify.authorize("CASOS", "editar")],
  }, async (request, reply) => {
    await deleteSession(request.authUser.id);
    return reply.send({ data: { message: "Sesión SISFE eliminada" } });
  });

  fastify.get("/auth/status", {
    preHandler: [fastify.authenticate, fastify.authorize("CASOS", "ver")],
  }, async (request) => {
    return { data: await getStatus(request.authUser.id) };
  });

  fastify.post("/auth/interactive", {
    preHandler: [fastify.authenticate, fastify.authorize("CASOS", "editar")],
  }, async (request, reply) => {
    try {
      await iniciarLoginInteractivo(request.authUser.id, request.authUser.estudioId);
      await SecurityAuditService.log({
        evento: "SISFE_CONNECT",
        request,
        statusCode: 200,
        metadata: { mode: "interactive" },
      });
      return reply.send({ data: { message: "Conectado exitosamente" } });
    } catch (error: any) {
      if (error.message === "BROWSER_CLOSED") {
        return reply.status(400).send({ error: { code: "BROWSER_CLOSED", message: "La ventana de inicio de sesión fue cerrada manualmente." } });
      }
      if (error.message === "JSESSIONID_NOT_FOUND") {
        return reply.status(400).send({ error: { code: "SESSION_NOT_FOUND", message: "No se pudo recuperar la sesión activa de la ventana." } });
      }
      request.log.error(error, "Interactive login failed");
      return reply.status(500).send({ error: { code: "INTERACTIVE_LOGIN_FAILED", message: "Ocurrió un error al abrir el navegador interactivo." } });
    }
  });

  /** Emite cookie httpOnly del proxy (sin JWT en querystring). */
  fastify.post("/proxy/bootstrap", {
    preHandler: [fastify.authenticate, fastify.authorize("CASOS", "ver")],
  }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Token requerido" } });
    }

    reply.setCookie(PROXY_COOKIE_NAME, authHeader.slice("Bearer ".length).trim(), {
      path: `${APP_SISFE_PREFIX}/proxy`,
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: PROXY_COOKIE_MAX_AGE_SEC,
    });

    return reply.send({ data: { message: "Proxy autenticado", expiresIn: PROXY_COOKIE_MAX_AGE_SEC } });
  });

  fastify.post("/sync", {
    preHandler: [
      fastify.authenticate,
      fastify.authorize("CASOS", "editar"),
      fastify.authorize("ADJUNTOS", "crear"),
    ],
  }, async (request: FastifyRequest<{ Body?: { casoId?: number } }>, reply) => {
    const status = await getStatus(request.authUser.id);
    if (!status.conectado) {
      return reply.status(400).send({ error: { code: "SISFE_SESSION_REQUIRED", message: "No hay sesión activa. Conectate al SISFE primero." } });
    }

    const claimed = await tryClaimSync(
      request.authUser.id,
      request.authUser.estudioId,
      "Preparando sincronización...",
    );
    if (!claimed) {
      return reply.status(409).send({
        error: { code: "SISFE_SYNC_RUNNING", message: "Sincronización ya en curso" },
      });
    }

    const { casoId } = request.body || {};
    await SecurityAuditService.log({
      evento: "SISFE_SYNC",
      request,
      statusCode: 202,
      metadata: { scopedToCase: Boolean(casoId) },
    });

    try {
      const job = await enqueueSisfeSync({
        usuarioId: request.authUser.id,
        estudioId: request.authUser.estudioId,
        casoId,
      });

      return reply.status(202).send({ data: { message: "Sincronización encolada", jobId: job.id } });
    } catch (error) {
      if (error instanceof SisfeSyncAlreadyRunningError) {
        await updateSyncStatus(request.authUser.id, "idle", 0, "Sincronización ya en curso");
        return reply.status(409).send({
          error: { code: "SISFE_SYNC_RUNNING", message: "Sincronización ya en curso" },
        });
      }

      request.log.error(error, "No se pudo encolar sincronización SISFE");
      await updateSyncStatus(
        request.authUser.id,
        "error",
        0,
        "No se pudo iniciar la sincronización. Verificá que Redis esté activo y reiniciá el backend.",
      );
      return reply.status(503).send({
        error: {
          code: "SISFE_SYNC_QUEUE_UNAVAILABLE",
          message: "No se pudo encolar la sincronización SISFE",
        },
      });
    }
  });

  fastify.post("/sync/cancel", {
    preHandler: [fastify.authenticate, fastify.authorize("CASOS", "editar")],
  }, async (request, reply) => {
    const running = await isSyncRunning(request.authUser.id);
    if (!running) {
      return reply.status(400).send({ error: { code: "SISFE_SYNC_NOT_RUNNING", message: "No hay ninguna sincronización activa para cancelar." } });
    }

    await updateSyncStatus(request.authUser.id, "idle", 0, "Sincronización cancelada por el usuario.");
    return reply.send({ data: { message: "Sincronización cancelada" } });
  });

  fastify.get("/sync/status", {
    preHandler: [fastify.authenticate, fastify.authorize("CASOS", "ver")],
  }, async (request) => {
    return { data: await getStatus(request.authUser.id) };
  });

  fastify.all("/proxy/*", async (request: FastifyRequest<{ Querystring: ProxyQuery }>, reply) => {
    const authenticated = await authenticateProxyRequest(fastify, request, reply);
    if (!authenticated) return reply;

    await fastify.authorize("CASOS", "ver")(request, reply);
    if (reply.sent) return reply;

    return proxySisfe(request, reply);
  });
};

async function authenticateProxyRequest(fastify: FastifyInstance, request: FastifyRequest<{ Querystring: ProxyQuery }>, reply: FastifyReply) {
  // El JWT de la app no viaja en URLs: solo Authorization header o cookie httpOnly del proxy.
  const cookieToken = request.cookies[PROXY_COOKIE_NAME];
  if (cookieToken && !request.headers.authorization) {
    request.headers.authorization = `Bearer ${cookieToken}`;
  }

  try {
    await fastify.authenticate(request, reply);
    if (reply.sent) return false;

    // Renovar cookie httpOnly de corta vida tras auth exitosa (header o cookie previa).
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      reply.setCookie(PROXY_COOKIE_NAME, token, {
        path: `${APP_SISFE_PREFIX}/proxy`,
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: PROXY_COOKIE_MAX_AGE_SEC,
      });
    }

    return true;
  } catch {
    if (!reply.sent) {
      reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Token inválido o expirado" } });
    }
    return false;
  }
}

async function proxySisfe(request: FastifyRequest<{ Querystring: ProxyQuery }>, reply: FastifyReply) {
  const proxiedPath = getProxiedPath(request);
  const targetUrl = resolveSafeProxyTarget(proxiedPath);
  if (!targetUrl) {
    request.log.warn({ proxiedPath }, "SSRF bloqueado en proxy SISFE");
    return reply.status(400).send({
      error: { code: "INVALID_PROXY_TARGET", message: "Destino de proxy no permitido" },
    });
  }

  // Limpiar restos legacy de querystring; el JWT de la app no debe reenviarse a SISFE.
  targetUrl.searchParams.delete("sisfeToken");
  targetUrl.searchParams.delete("token");

  const headers = buildProxyHeaders(request);
  const body = typeof request.body === "string"
    ? request.body
    : Buffer.isBuffer(request.body)
      ? new Uint8Array(request.body)
      : undefined;
  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : body,
    redirect: "manual",
  });

  await persistCookieIfPresent(response, request, targetUrl);

  const location = response.headers.get("location");
  if (location?.includes("/buscar-expediente")) {
    return reply.redirect(`${APP_SISFE_PREFIX}/auth/success`);
  }

  if (location) {
    const rewritten = rewriteLocationSafe(location);
    if (!rewritten) {
      request.log.warn({ location }, "Location de proxy SISFE rechazado");
      return reply.status(400).send({
        error: { code: "INVALID_PROXY_REDIRECT", message: "Redirect de proxy no permitido" },
      });
    }
    return reply
      .status(response.status)
      .header("location", rewritten)
      .send();
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  reply.status(response.status).type(contentType);

  response.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!["content-encoding", "content-length", "set-cookie", "transfer-encoding"].includes(lowerKey)) {
      reply.header(key, value);
    }
  });

  if (contentType.includes("text/html")) {
    const html = await response.text();
    return reply.send(rewriteHtml(html));
  }

  const arrayBuffer = await response.arrayBuffer();
  return reply.send(Buffer.from(arrayBuffer));
}

function getProxiedPath(request: FastifyRequest) {
  const url = new URL(request.url, "http://iuris.local");
  const marker = "/proxy";
  const markerIndex = url.pathname.indexOf(marker);
  const path = markerIndex >= 0 ? url.pathname.slice(markerIndex + marker.length) || "/" : "/";
  url.searchParams.delete("sisfeToken");
  url.searchParams.delete("token");
  return `${path}${url.search}`;
}

function buildProxyHeaders(request: FastifyRequest) {
  const headers = new Headers();
  const forwarded = ["accept", "accept-language", "content-type", "user-agent"];
  for (const key of forwarded) {
    const value = request.headers[key];
    if (typeof value === "string") headers.set(key, value);
  }
  headers.set("host", "sisfe.justiciasantafe.gov.ar");
  headers.set("origin", SISFE_BASE_URL);
  headers.set("referer", SISFE_BASE_URL);
  return headers;
}

async function persistCookieIfPresent(response: Response, request: FastifyRequest, targetUrl: URL) {
  // Nunca persistir Set-Cookie de un host que no sea SISFE (defensa ante SSRF).
  if (!isAllowedSisfeTarget(targetUrl)) return;

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie || !request.authUser) return;

  const firstCookie = setCookie.split(/,(?=\s*[^;,=\s]+=[^;,]+)/)[0];
  const [nameValue] = firstCookie.split(";");
  const separatorIndex = nameValue.indexOf("=");
  if (separatorIndex <= 0) return;

  const cookieName = nameValue.slice(0, separatorIndex).trim();
  const cookieValue = nameValue.slice(separatorIndex + 1).trim();
  if (!cookieName || !cookieValue) return;

  await mergeSessionCookie(request.authUser.id, request.authUser.estudioId, cookieName, cookieValue);
}

function rewriteHtml(html: string) {
  return html
    .replaceAll(SISFE_BASE_URL, `${APP_SISFE_PREFIX}/proxy`)
    .replace(/\b(href|action|src)="\/(?!api\/sisfe\/proxy|api\/v1\/sisfe\/proxy)/g, (_match, attr: string) => `${attr}="${APP_SISFE_PREFIX}/proxy/`);
}
