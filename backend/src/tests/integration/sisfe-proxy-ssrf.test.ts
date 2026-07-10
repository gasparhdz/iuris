import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { estudios, permisos, roles, usuarioRoles, usuarios } from "../../db/schema.js";
import { authPlugin } from "../../plugins/auth.plugin.js";
import { errorHandlerPlugin } from "../../plugins/error-handler.plugin.js";
import { sisfeRoutes } from "../../routes/sisfe.routes.js";

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(sisfeRoutes, { prefix: "/api/v1/sisfe" });
  await app.ready();
  return app;
}

let app: FastifyInstance;
let estudioId: number;
let rolId: number;
let user: { id: number; tokenVersion: number };
const stamp = Date.now();

beforeAll(async () => {
  app = await buildApp();

  const [est] = await db.insert(estudios).values({ nombre: `SSRF Estudio ${stamp}` }).returning({ id: estudios.id });
  estudioId = est.id;
  const [rol] = await db.insert(roles).values({ codigo: `SSRF_${stamp}`, nombre: "SSRF" }).returning({ id: roles.id });
  rolId = rol.id;
  await db.insert(permisos).values({ rolId, modulo: "CASOS", ver: true });
  const [u] = await db.insert(usuarios).values({
    estudioId,
    nombre: "Ssrf",
    apellido: "Test",
    email: `ssrf_${stamp}@test.local`,
    passwordHash: "x",
  }).returning({ id: usuarios.id, tokenVersion: usuarios.tokenVersion });
  user = u;
  await db.insert(usuarioRoles).values({ usuarioId: user.id, rolId });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await db.delete(usuarioRoles).where(eq(usuarioRoles.usuarioId, user.id));
  await db.delete(usuarios).where(eq(usuarios.id, user.id));
  await db.delete(permisos).where(eq(permisos.rolId, rolId));
  await db.delete(roles).where(eq(roles.id, rolId));
  await db.delete(estudios).where(eq(estudios.id, estudioId));
  await app.close();
});

describe("proxy SISFE HTTP — anti-SSRF", () => {
  it("GET //evil.com y path absoluto → 400; path SISFE → fetch al host permitido", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const token = app.jwt.sign({
      id: user.id,
      estudioId,
      rol: `SSRF_${stamp}`,
      tokenVersion: user.tokenVersion,
    });
    const auth = { authorization: `Bearer ${token}` };

    const evilRelative = await app.inject({
      method: "GET",
      url: "/api/v1/sisfe/proxy//evil.com/payload",
      headers: auth,
    });
    expect(evilRelative.statusCode).toBe(400);
    expect(evilRelative.json().error.code).toBe("INVALID_PROXY_TARGET");

    const evilAbsolute = await app.inject({
      method: "GET",
      url: "/api/v1/sisfe/proxy/http://evil.com/x",
      headers: auth,
    });
    expect(evilAbsolute.statusCode).toBe(400);
    expect(evilAbsolute.json().error.code).toBe("INVALID_PROXY_TARGET");

    expect(fetchMock).not.toHaveBeenCalled();

    const ok = await app.inject({
      method: "GET",
      url: "/api/v1/sisfe/proxy/buscar-expediente",
      headers: auth,
    });
    expect(ok.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
    const called = fetchMock.mock.calls.at(0)?.at(0);
    expect(String(called)).toMatch(/^https:\/\/sisfe\.justiciasantafe\.gov\.ar\//);
  });
});
