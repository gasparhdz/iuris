import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { estudios, permisos, roles, usuarioRoles, usuarios } from "../../db/schema.js";
import { authPlugin } from "../../plugins/auth.plugin.js";
import { errorHandlerPlugin } from "../../plugins/error-handler.plugin.js";
import { equipoRoutes } from "../../routes/equipo.routes.js";

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(equipoRoutes, { prefix: "/equipo" });
  await app.ready();
  return app;
}

let app: FastifyInstance;
let estudioId: number;
let rolEquipo: number;
let director: { id: number; tokenVersion: number };
let target: { id: number; tokenVersion: number };
const stamp = Date.now();

beforeAll(async () => {
  app = await buildApp();

  const [est] = await db.insert(estudios).values({ nombre: `Equipo Roles ${stamp}`, maxUsuarios: 10 }).returning({ id: estudios.id });
  estudioId = est.id;

  const [rEq] = await db.insert(roles).values({ codigo: `EQEDIT_${stamp}`, nombre: "Equipo edit" }).returning({ id: roles.id });
  rolEquipo = rEq.id;
  await db.insert(permisos).values({
    rolId: rolEquipo,
    modulo: "EQUIPO",
    ver: true,
    crear: true,
    editar: true,
    eliminar: true,
  });

  for (const codigo of ["DIRECTOR", "ABOGADO", "ASISTENTE"] as const) {
    const [existing] = await db.select().from(roles).where(eq(roles.codigo, codigo)).limit(1);
    if (!existing) {
      await db.insert(roles).values({ codigo, nombre: codigo });
    }
  }

  const [uDir] = await db.insert(usuarios).values({
    estudioId,
    nombre: "Dir",
    apellido: "Equipo",
    email: `dir_eq_${stamp}@test.local`,
    passwordHash: "x",
  }).returning({ id: usuarios.id, tokenVersion: usuarios.tokenVersion });
  director = uDir;

  const [uTarget] = await db.insert(usuarios).values({
    estudioId,
    nombre: "Target",
    apellido: "User",
    email: `target_eq_${stamp}@test.local`,
    passwordHash: "x",
  }).returning({ id: usuarios.id, tokenVersion: usuarios.tokenVersion });
  target = uTarget;

  const [directorRole] = await db.select().from(roles).where(eq(roles.codigo, "DIRECTOR")).limit(1);
  const [abogadoRole] = await db.select().from(roles).where(eq(roles.codigo, "ABOGADO")).limit(1);

  await db.insert(usuarioRoles).values([
    { usuarioId: director.id, rolId: rolEquipo },
    { usuarioId: target.id, rolId: abogadoRole!.id },
  ]);
  if (directorRole) {
    await db.insert(usuarioRoles).values({ usuarioId: director.id, rolId: directorRole.id });
  }
});

afterAll(async () => {
  await db.delete(usuarioRoles).where(inArray(usuarioRoles.usuarioId, [director.id, target.id]));
  // Soft-delete: security_audit es append-only y referencia usuario_id (no hard-delete).
  await db.update(usuarios)
    .set({ deletedAt: new Date(), activo: false, email: `deleted_eq_${stamp}_${director.id}@test.local` })
    .where(eq(usuarios.id, director.id));
  await db.update(usuarios)
    .set({ deletedAt: new Date(), activo: false, email: `deleted_eq_${stamp}_${target.id}@test.local` })
    .where(eq(usuarios.id, target.id));
  await db.delete(permisos).where(eq(permisos.rolId, rolEquipo));
  await db.delete(roles).where(eq(roles.id, rolEquipo));
  await db.update(estudios).set({ activo: false }).where(eq(estudios.id, estudioId));
  await app.close();
});

function tokenFor(user: { id: number; tokenVersion: number }) {
  return app.jwt.sign({
    id: user.id,
    estudioId,
    rol: "DIRECTOR",
    tokenVersion: user.tokenVersion,
  });
}

describe("EQUIPO HTTP — bloqueo de roles de plataforma", () => {
  it("PUT con rol SUPERADMIN → 403", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/equipo/usuarios/${target.id}`,
      headers: { authorization: `Bearer ${tokenFor(director)}` },
      payload: { rol: "SUPERADMIN" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("PLATFORM_ROLE_FORBIDDEN");
  });

  it("PUT con rol ADMIN → 403", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/equipo/usuarios/${target.id}`,
      headers: { authorization: `Bearer ${tokenFor(director)}` },
      payload: { rol: "ADMIN" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("PLATFORM_ROLE_FORBIDDEN");
  });

  it("PUT con rol de tenant válido → 200", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/equipo/usuarios/${target.id}`,
      headers: { authorization: `Bearer ${tokenFor(director)}` },
      payload: { rol: "ASISTENTE" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.roles).toContain("ASISTENTE");
  });
});
