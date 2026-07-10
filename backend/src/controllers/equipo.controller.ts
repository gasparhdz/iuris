import type { FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { and, asc, count, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { estudios, roles, usuarioRoles, usuarios } from "../db/schema.js";
import { AuthQueries } from "../db/queries/auth.queries.js";
import { SecurityAuditService } from "../services/security-audit.service.js";

export type EquipoUsuarioBody = {
  nombre?: string;
  apellido?: string;
  email?: string;
  dni?: string | null;
  telefono?: string | null;
  password?: string;
  rol?: string;
};

export type UsuarioParams = {
  usuarioId: string;
};

function parseId(value: string) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeRoleCode(value?: string) {
  return String(value || "ABOGADO")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .toUpperCase();
}

/** Roles de plataforma: solo asignables desde el panel admin SaaS. */
const PLATFORM_ROLES = new Set(["SUPERADMIN", "ADMIN"]);

/** Roles de tenant permitidos desde el módulo EQUIPO. */
const TENANT_ROLES = new Set(["DIRECTOR", "ABOGADO", "ASISTENTE", "ASESOR_FINANCIERO"]);

/**
 * Valida que el rol sea asignable desde EQUIPO (allowlist + denylist de plataforma).
 * Exportado para tests.
 */
export function assertAssignableEquipoRole(rolCodigo?: string): string {
  const normalized = normalizeRoleCode(rolCodigo);
  if (PLATFORM_ROLES.has(normalized) || !TENANT_ROLES.has(normalized)) {
    throw new Error("PLATFORM_ROLE_FORBIDDEN");
  }
  return normalized;
}

function roleName(codigo: string) {
  const nombreMap: Record<string, string> = {
    DIRECTOR: "Director",
    ABOGADO: "Abogado",
    ASISTENTE: "Asistente",
    ASESOR_FINANCIERO: "Asesor Financiero",
  };
  return nombreMap[codigo] ?? codigo;
}

async function getUserRoles(usuarioId: number): Promise<string[]> {
  const rows = await db
    .select({ codigo: roles.codigo })
    .from(usuarioRoles)
    .innerJoin(roles, eq(usuarioRoles.rolId, roles.id))
    .where(eq(usuarioRoles.usuarioId, usuarioId));
  return rows.map((row) => row.codigo);
}

async function serializeUsuario(row: typeof usuarios.$inferSelect) {
  return {
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    email: row.email,
    dni: row.dni,
    telefono: row.telefono,
    activo: row.activo,
    lastLoginAt: row.lastLoginAt,
    mustChangePass: row.mustChangePass,
    createdAt: row.createdAt,
    roles: await getUserRoles(row.id),
  };
}

async function findOrCreateRole(codigo: string) {
  const normalized = normalizeRoleCode(codigo);
  const [existing] = await db.select().from(roles).where(eq(roles.codigo, normalized)).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(roles)
    .values({ codigo: normalized, nombre: roleName(normalized) })
    .returning();
  return created;
}

async function replaceUserRole(usuarioId: number, rolCodigo: string) {
  const normalized = assertAssignableEquipoRole(rolCodigo);
  const role = await findOrCreateRole(normalized);
  await db.delete(usuarioRoles).where(eq(usuarioRoles.usuarioId, usuarioId));
  await db.insert(usuarioRoles).values({ usuarioId, rolId: role.id });
  await bumpUserTokenVersion(usuarioId);
}

async function bumpUserTokenVersion(usuarioId: number) {
  await db.update(usuarios).set({ tokenVersion: sql`${usuarios.tokenVersion} + 1` }).where(eq(usuarios.id, usuarioId));
}

async function activeDirectorsCount(estudioId: number) {
  const rows = await db
    .select({ uid: usuarioRoles.usuarioId })
    .from(usuarioRoles)
    .innerJoin(roles, eq(usuarioRoles.rolId, roles.id))
    .innerJoin(usuarios, eq(usuarioRoles.usuarioId, usuarios.id))
    .where(and(eq(roles.codigo, "DIRECTOR"), eq(usuarios.estudioId, estudioId), eq(usuarios.activo, true), isNull(usuarios.deletedAt)));
  return rows.length;
}

export async function listarMiembrosEstudio(request: FastifyRequest, reply: FastifyReply) {
  const rows = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      apellido: usuarios.apellido,
      email: usuarios.email,
    })
    .from(usuarios)
    .where(and(eq(usuarios.estudioId, request.authUser.estudioId), eq(usuarios.activo, true), isNull(usuarios.deletedAt)))
    .orderBy(asc(usuarios.nombre), asc(usuarios.apellido));

  return reply.send({
    data: rows.map((row) => ({
      id: row.id,
      nombre: [row.nombre, row.apellido].filter(Boolean).join(" ") || row.email,
    })),
  });
}

export async function listarEquipoUsuarios(request: FastifyRequest, reply: FastifyReply) {
  const rows = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.estudioId, request.authUser.estudioId), isNull(usuarios.deletedAt)))
    .orderBy(asc(usuarios.nombre), asc(usuarios.apellido));

  return reply.send({ data: await Promise.all(rows.map(serializeUsuario)) });
}

export async function crearEquipoUsuario(
  request: FastifyRequest<{ Body: EquipoUsuarioBody }>,
  reply: FastifyReply
) {
  const estudioId = request.authUser.estudioId;
  const body = request.body ?? {};
  const nombre = body.nombre?.trim();
  const apellido = body.apellido?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!nombre || !apellido || !email || !body.password) {
    return reply.status(400).send({
      error: { code: "BAD_REQUEST", message: "nombre, apellido, email y password son requeridos" },
    });
  }

  const [countRow] = await db
    .select({ total: count() })
    .from(usuarios)
    .where(and(eq(usuarios.estudioId, estudioId), eq(usuarios.activo, true), isNull(usuarios.deletedAt)));
  const [estudio] = await db
    .select({ maxUsuarios: estudios.maxUsuarios })
    .from(estudios)
    .where(eq(estudios.id, estudioId))
    .limit(1);
  const maxUsuariosLimit = estudio?.maxUsuarios ?? 1;

  if (Number(countRow?.total ?? 0) >= maxUsuariosLimit) {
    return reply.status(400).send({
      error: {
        code: "LIMIT_EXCEEDED",
        message: `El estudio alcanzó el límite máximo de ${maxUsuariosLimit} usuarios de su plan comercial.`,
      },
    });
  }

  const existing = await AuthQueries.findUserByEmail(email);
  if (existing) {
    return reply.status(409).send({ error: { code: "EMAIL_IN_USE", message: "El email ya esta registrado" } });
  }

  let roleCodigo: string;
  try {
    roleCodigo = assertAssignableEquipoRole(body.rol || "ABOGADO");
  } catch {
    return reply.status(403).send({
      error: {
        code: "PLATFORM_ROLE_FORBIDDEN",
        message: "No se pueden asignar roles de plataforma ni roles no permitidos desde Equipo",
      },
    });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const [created] = await db
    .insert(usuarios)
    .values({
      estudioId,
      nombre,
      apellido,
      email,
      passwordHash,
      dni: body.dni?.trim() || null,
      telefono: body.telefono?.trim() || null,
      mustChangePass: true,
    })
    .returning();

  await replaceUserRole(created.id, roleCodigo);
  await SecurityAuditService.log({
    evento: "USER_CREATE",
    request,
    targetEstudioId: estudioId,
    metadata: { targetUsuarioId: created.id, rol: roleCodigo },
  });
  return reply.status(201).send({ data: await serializeUsuario(created) });
}

export async function actualizarEquipoUsuario(
  request: FastifyRequest<{ Params: UsuarioParams; Body: EquipoUsuarioBody }>,
  reply: FastifyReply
) {
  const estudioId = request.authUser.estudioId;
  const usuarioId = parseId(request.params.usuarioId);
  if (!usuarioId) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID invalido" } });

  const [current] = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.id, usuarioId), eq(usuarios.estudioId, estudioId), isNull(usuarios.deletedAt)))
    .limit(1);
  if (!current) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Usuario no encontrado" } });

  const body = request.body ?? {};
  const updateData: Partial<typeof usuarios.$inferInsert> = {};
  if (body.nombre !== undefined) updateData.nombre = body.nombre.trim();
  if (body.apellido !== undefined) updateData.apellido = body.apellido.trim();
  if (body.dni !== undefined) updateData.dni = body.dni?.trim() || null;
  if (body.telefono !== undefined) updateData.telefono = body.telefono?.trim() || null;
  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    const [owner] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.email, email), ne(usuarios.id, usuarioId)))
      .limit(1);
    if (owner) return reply.status(409).send({ error: { code: "EMAIL_IN_USE", message: "El email ya esta en uso" } });
    updateData.email = email;
  }
  const nextRole = body.rol ? normalizeRoleCode(body.rol) : null;
  if (nextRole) {
    try {
      assertAssignableEquipoRole(nextRole);
    } catch {
      return reply.status(403).send({
        error: {
          code: "PLATFORM_ROLE_FORBIDDEN",
          message: "No se pueden asignar roles de plataforma ni roles no permitidos desde Equipo",
        },
      });
    }
  }
  if (nextRole && nextRole !== "DIRECTOR") {
    const currentRoles = await getUserRoles(usuarioId);
    if (currentRoles.includes("DIRECTOR") && (await activeDirectorsCount(estudioId)) <= 1) {
      return reply.status(400).send({
        error: { code: "LAST_DIRECTOR", message: "No podes cambiar el rol del unico Director del estudio." },
      });
    }
  }

  const [updated] = Object.keys(updateData).length
    ? await db
        .update(usuarios)
        .set(updateData)
        .where(and(eq(usuarios.id, usuarioId), eq(usuarios.estudioId, estudioId), isNull(usuarios.deletedAt)))
        .returning()
    : [current];

  if (body.rol) {
    await replaceUserRole(usuarioId, body.rol);
    await SecurityAuditService.log({
      evento: "ROLE_CHANGE",
      request,
      targetEstudioId: estudioId,
      metadata: { targetUsuarioId: usuarioId, rol: normalizeRoleCode(body.rol) },
    });
  }
  return reply.send({ data: await serializeUsuario(updated) });
}

export async function toggleEquipoUsuario(
  request: FastifyRequest<{ Params: UsuarioParams }>,
  reply: FastifyReply
) {
  const estudioId = request.authUser.estudioId;
  const usuarioId = parseId(request.params.usuarioId);
  if (!usuarioId) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID invalido" } });
  if (usuarioId === request.authUser.id) {
    return reply.status(400).send({ error: { code: "SELF_ACTION", message: "No podes desactivar tu propia cuenta." } });
  }

  const [current] = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.id, usuarioId), eq(usuarios.estudioId, estudioId), isNull(usuarios.deletedAt)))
    .limit(1);
  if (!current) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Usuario no encontrado" } });

  const [updated] = await db
    .update(usuarios)
    .set({ activo: !current.activo, tokenVersion: sql`${usuarios.tokenVersion} + 1` })
    .where(and(eq(usuarios.id, usuarioId), eq(usuarios.estudioId, estudioId), isNull(usuarios.deletedAt)))
    .returning();
  await SecurityAuditService.log({
    evento: "USER_DISABLE",
    request,
    targetEstudioId: estudioId,
    metadata: { targetUsuarioId: usuarioId, activo: updated.activo },
  });

  return reply.send({ data: await serializeUsuario(updated) });
}

export async function eliminarEquipoUsuario(
  request: FastifyRequest<{ Params: UsuarioParams }>,
  reply: FastifyReply
) {
  const estudioId = request.authUser.estudioId;
  const usuarioId = parseId(request.params.usuarioId);
  if (!usuarioId) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID invalido" } });
  if (usuarioId === request.authUser.id) {
    return reply.status(400).send({ error: { code: "SELF_ACTION", message: "No podes eliminar tu propia cuenta." } });
  }

  const [deleted] = await db
    .update(usuarios)
    .set({ deletedAt: new Date(), activo: false, tokenVersion: sql`${usuarios.tokenVersion} + 1` })
    .where(and(eq(usuarios.id, usuarioId), eq(usuarios.estudioId, estudioId), isNull(usuarios.deletedAt)))
    .returning();
  if (!deleted) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Usuario no encontrado" } });
  await SecurityAuditService.log({
    evento: "USER_DISABLE",
    request,
    targetEstudioId: estudioId,
    metadata: { targetUsuarioId: usuarioId, deleted: true },
  });

  return reply.send({ data: { message: "Usuario eliminado del equipo" } });
}
