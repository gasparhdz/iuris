import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { estudios, permisos, roles, usuarioRoles, usuarios } from "../../db/schema.js";
import { authPlugin } from "../../plugins/auth.plugin.js";
import { errorHandlerPlugin } from "../../plugins/error-handler.plugin.js";
import { valorJusRoutes } from "../../routes/valorjus.routes.js";

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(valorJusRoutes, { prefix: "/valorjus" });
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

  // Estudio distinto de 1 (plataforma): un ABOGADO de tenant común.
  const [est] = await db.insert(estudios).values({ nombre: `ValorJUS Tenant ${stamp}` }).returning({ id: estudios.id });
  estudioId = est.id;
  expect(estudioId).not.toBe(1);

  const [rol] = await db.insert(roles).values({ codigo: `VJ_${stamp}`, nombre: "Abogado VJ" }).returning({ id: roles.id });
  rolId = rol.id;
  await db.insert(permisos).values({
    rolId,
    modulo: "VALORJUS",
    ver: true,
    crear: true,
    editar: true,
    eliminar: true,
  });

  const [u] = await db.insert(usuarios).values({
    estudioId,
    nombre: "Abogado",
    apellido: "Tenant",
    email: `vj_${stamp}@test.local`,
    passwordHash: "x",
  }).returning({ id: usuarios.id, tokenVersion: usuarios.tokenVersion });
  user = u;
  await db.insert(usuarioRoles).values({ usuarioId: user.id, rolId });
});

afterAll(async () => {
  await db.delete(usuarioRoles).where(eq(usuarioRoles.usuarioId, user.id));
  await db.update(usuarios).set({ deletedAt: new Date(), activo: false, email: `del_vj_${stamp}@test.local` }).where(eq(usuarios.id, user.id));
  await db.delete(permisos).where(eq(permisos.rolId, rolId));
  await db.delete(roles).where(eq(roles.id, rolId));
  await db.update(estudios).set({ activo: false }).where(eq(estudios.id, estudioId));
  await app.close();
});

function token() {
  return app.jwt.sign({
    id: user.id,
    estudioId,
    rol: "ABOGADO",
    tokenVersion: user.tokenVersion,
  });
}

describe("Valor JUS — mutaciones solo admin plataforma", () => {
  it("ABOGADO de estudio común recibe 403 en POST", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/valorjus/",
      headers: { authorization: `Bearer ${token()}` },
      payload: { valor: 100, fecha: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("ABOGADO de estudio común recibe 403 en PUT y DELETE", async () => {
    const put = await app.inject({
      method: "PUT",
      url: "/valorjus/1",
      headers: { authorization: `Bearer ${token()}` },
      payload: { valor: 200 },
    });
    expect(put.statusCode).toBe(403);

    const del = await app.inject({
      method: "DELETE",
      url: "/valorjus/1",
      headers: { authorization: `Bearer ${token()}` },
    });
    expect(del.statusCode).toBe(403);
  });

  it("ABOGADO con VALORJUS ver puede GET", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/valorjus/actual",
      headers: { authorization: `Bearer ${token()}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
