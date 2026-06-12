import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { estudios, permisos, roles, usuarioRoles, usuarios } from "../../db/schema.js";
import { authPlugin } from "../../plugins/auth.plugin.js";
import { errorHandlerPlugin } from "../../plugins/error-handler.plugin.js";
import { clientesRoutes } from "../../routes/clientes.routes.js";

// Levanta una app Fastify real (sin escuchar) para probar el RBAC end-to-end vía inject():
// el preHandler authenticate+authorize sobre rutas reales. Verifica que un usuario SIN el
// permiso `ver` sobre CLIENTES reciba 403, y que con el permiso reciba 200 (OWASP A01).
async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(clientesRoutes, { prefix: "/clientes" });
  await app.ready();
  return app;
}

let app: FastifyInstance;
let estudioId: number;
let rolSinPermiso: number;
let rolConVer: number;
let userSinPermiso: { id: number; tokenVersion: number };
let userConVer: { id: number; tokenVersion: number };

const stamp = Date.now();

beforeAll(async () => {
  app = await buildApp();

  const [est] = await db.insert(estudios).values({ nombre: "Estudio AuthZ (test)" }).returning({ id: estudios.id });
  estudioId = est.id;

  const [rSin] = await db.insert(roles).values({ codigo: `SINPERM_${stamp}`, nombre: "Sin permisos" }).returning({ id: roles.id });
  const [rVer] = await db.insert(roles).values({ codigo: `CONVER_${stamp}`, nombre: "Con ver" }).returning({ id: roles.id });
  rolSinPermiso = rSin.id;
  rolConVer = rVer.id;

  // rolSinPermiso: explícitamente sin `ver` sobre CLIENTES. rolConVer: con `ver`.
  await db.insert(permisos).values({ rolId: rolSinPermiso, modulo: "CLIENTES", ver: false });
  await db.insert(permisos).values({ rolId: rolConVer, modulo: "CLIENTES", ver: true });

  const [uSin] = await db.insert(usuarios)
    .values({ estudioId, nombre: "Sin", apellido: "Permiso", email: `sin_${stamp}@test.local`, passwordHash: "x" })
    .returning({ id: usuarios.id, tokenVersion: usuarios.tokenVersion });
  const [uVer] = await db.insert(usuarios)
    .values({ estudioId, nombre: "Con", apellido: "Ver", email: `ver_${stamp}@test.local`, passwordHash: "x" })
    .returning({ id: usuarios.id, tokenVersion: usuarios.tokenVersion });
  userSinPermiso = uSin;
  userConVer = uVer;

  await db.insert(usuarioRoles).values({ usuarioId: userSinPermiso.id, rolId: rolSinPermiso });
  await db.insert(usuarioRoles).values({ usuarioId: userConVer.id, rolId: rolConVer });
});

afterAll(async () => {
  await db.delete(usuarioRoles).where(inArray(usuarioRoles.usuarioId, [userSinPermiso.id, userConVer.id]));
  await db.delete(usuarios).where(inArray(usuarios.id, [userSinPermiso.id, userConVer.id]));
  await db.delete(permisos).where(inArray(permisos.rolId, [rolSinPermiso, rolConVer]));
  await db.delete(roles).where(inArray(roles.id, [rolSinPermiso, rolConVer]));
  await db.delete(estudios).where(eq(estudios.id, estudioId));
  await app.close();
});

function tokenFor(user: { id: number; tokenVersion: number }, rol: string): string {
  return app.jwt.sign({ id: user.id, estudioId, rol, tokenVersion: user.tokenVersion });
}

describe("RBAC HTTP (authenticate + authorize)", () => {
  it("sin token → 401", async () => {
    const res = await app.inject({ method: "GET", url: "/clientes/" });
    expect(res.statusCode).toBe(401);
  });

  it("usuario sin permiso `ver` sobre CLIENTES → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/clientes/",
      headers: { authorization: `Bearer ${tokenFor(userSinPermiso, "SINPERM")}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("usuario con permiso `ver` → 200", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/clientes/",
      headers: { authorization: `Bearer ${tokenFor(userConVer, "CONVER")}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("usuario con `ver` pero sin `crear` → 403 al intentar crear", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/clientes/",
      headers: { authorization: `Bearer ${tokenFor(userConVer, "CONVER")}` },
      payload: { tipoPersonaId: 143, nombre: "X", apellido: "Y" },
    });
    expect(res.statusCode).toBe(403);
  });
});
