import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { deleteSession, getStatus, isSyncRunning, saveSession, verifySesionActiva, iniciarLoginInteractivo, updateSyncStatus } from "../services/sisfe-session.service.js";
import { enqueueSisfeSync } from "../queue/sisfe.queue.js";
import { SecurityAuditService } from "../services/security-audit.service.js";

const SISFE_BASE_URL = "https://sisfe.justiciasantafe.gov.ar";
const APP_SISFE_PREFIX = "/lex/api/sisfe";

type ProxyQuery = {
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
    return reply.type("text/html").send(`<!DOCTYPE html><html><body>
<script>if(window.opener){window.opener.postMessage({event:'SISFE_LOGIN_OK'},'*')}window.close()</script>
<p>Autenticación exitosa. Puede cerrar esta ventana.</p>
</body></html>`);
  });

  fastify.post("/auth/session", { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Body: ManualSessionBody }>, reply) => {
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

  fastify.delete("/auth/session", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    await deleteSession(request.authUser.id);
    return reply.send({ data: { message: "Sesión SISFE eliminada" } });
  });

  fastify.get("/auth/status", { preHandler: [fastify.authenticate] }, async (request) => {
    return { data: await getStatus(request.authUser.id) };
  });

  fastify.post("/auth/interactive", { preHandler: [fastify.authenticate] }, async (request, reply) => {
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

  fastify.post("/sync", { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Body?: { casoId?: number } }>, reply) => {
    const status = await getStatus(request.authUser.id);
    if (!status.conectado) {
      return reply.status(400).send({ error: { code: "SISFE_SESSION_REQUIRED", message: "No hay sesión activa. Conectate al SISFE primero." } });
    }

    const running = await isSyncRunning(request.authUser.id);
    if (running) {
      return reply.status(409).send({ error: { code: "SISFE_SYNC_RUNNING", message: "Ya hay una sincronización en curso" } });
    }

    const { casoId } = request.body || {};
    await SecurityAuditService.log({
      evento: "SISFE_SYNC",
      request,
      statusCode: 202,
      metadata: { scopedToCase: Boolean(casoId) },
    });

    const job = await enqueueSisfeSync({
      usuarioId: request.authUser.id,
      estudioId: request.authUser.estudioId,
      casoId,
    });

    return reply.status(202).send({ data: { message: "Sincronización encolada", jobId: job.id } });
  });

  fastify.post("/sync/cancel", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const running = await isSyncRunning(request.authUser.id);
    if (!running) {
      return reply.status(400).send({ error: { code: "SISFE_SYNC_NOT_RUNNING", message: "No hay ninguna sincronización activa para cancelar." } });
    }

    await updateSyncStatus(request.authUser.id, "idle", 0, "Sincronización cancelada por el usuario.");
    return reply.send({ data: { message: "Sincronización cancelada" } });
  });

  fastify.get("/sync/status", { preHandler: [fastify.authenticate] }, async (request) => {
    return { data: await getStatus(request.authUser.id) };
  });

  fastify.all("/proxy/*", async (request: FastifyRequest<{ Querystring: ProxyQuery }>, reply) => {
    const authenticated = await authenticateProxyRequest(fastify, request, reply);
    if (!authenticated) return reply;

    return proxySisfe(request, reply);
  });
};

async function authenticateProxyRequest(fastify: FastifyInstance, request: FastifyRequest<{ Querystring: ProxyQuery }>, reply: FastifyReply) {
  let token = request.query.sisfeToken ?? request.query.token;

  if (token) {
    // Guardar token en cookie para autenticar sub-recursos (JS, CSS, imágenes)
    reply.setCookie("sisfe_proxy_jwt", token, {
      path: `${APP_SISFE_PREFIX}/proxy`,
      httpOnly: true,
      secure: false, // local development
      sameSite: "lax",
      maxAge: 3600, // 1 hora
    });
  } else {
    // Si no viene en la query, intentar leer de la cookie
    token = request.cookies.sisfe_proxy_jwt;
  }

  if (token && !request.headers.authorization) {
    request.headers.authorization = `Bearer ${token}`;
  }

  try {
    await fastify.authenticate(request, reply);
    return !reply.sent;
  } catch {
    if (!reply.sent) {
      reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Token inválido o expirado" } });
    }
    return false;
  }
}

async function proxySisfe(request: FastifyRequest<{ Querystring: ProxyQuery }>, reply: FastifyReply) {
  const proxiedPath = getProxiedPath(request);
  const targetUrl = new URL(proxiedPath, SISFE_BASE_URL);
  const token = request.query.sisfeToken ?? request.query.token;
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

  await persistCookieIfPresent(response, request);

  const location = response.headers.get("location");
  if (location?.includes("/buscar-expediente")) {
    return reply.redirect(`${APP_SISFE_PREFIX}/auth/success`);
  }

  if (location) {
    return reply
      .status(response.status)
      .header("location", rewriteLocation(location, token))
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
    return reply.send(rewriteHtml(html, token));
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

async function persistCookieIfPresent(response: Response, request: FastifyRequest) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie || !request.authUser) return;

  const firstCookie = setCookie.split(/,(?=\s*[^;,=\s]+=[^;,]+)/)[0];
  const [nameValue] = firstCookie.split(";");
  const separatorIndex = nameValue.indexOf("=");
  if (separatorIndex <= 0) return;

  const cookieName = nameValue.slice(0, separatorIndex).trim();
  const cookieValue = nameValue.slice(separatorIndex + 1).trim();
  if (!cookieName || !cookieValue) return;

  await saveSession(request.authUser.id, request.authUser.estudioId, cookieName, cookieValue);
}

function rewriteLocation(location: string, token?: string) {
  const path = location.startsWith(SISFE_BASE_URL)
    ? location.slice(SISFE_BASE_URL.length)
    : location;
  return appendProxyToken(`${APP_SISFE_PREFIX}/proxy${path.startsWith("/") ? path : `/${path}`}`, token);
}

function rewriteHtml(html: string, token?: string) {
  const tokenParam = token ? `sisfeToken=${encodeURIComponent(token)}` : "";
  const withProxy = html
    .replaceAll(SISFE_BASE_URL, `${APP_SISFE_PREFIX}/proxy`)
    .replace(/\b(href|action|src)="\/(?!lex\/api\/sisfe\/proxy|api\/v1\/sisfe\/proxy)/g, (_match, attr: string) => `${attr}="${APP_SISFE_PREFIX}/proxy/`);

  if (!tokenParam) return withProxy;

  return withProxy.replace(/(href|action|src)="([^"]*\/lex\/api\/sisfe\/proxy[^"]*)"/g, (_match, attr: string, url: string) => {
    return `${attr}="${appendQuery(url, tokenParam)}"`;
  });
}

function appendProxyToken(url: string, token?: string) {
  if (!token) return url;
  return appendQuery(url, `sisfeToken=${encodeURIComponent(token)}`);
}

function appendQuery(url: string, query: string) {
  if (url.includes("sisfeToken=")) return url;
  const hashIndex = url.indexOf("#");
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  return `${base}${base.includes("?") ? "&" : "?"}${query}${hash}`;
}
