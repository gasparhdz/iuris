import type { FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { and, asc, count, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { casos, clientes, estudios, permisos, planesSuscripcion, roles, usuarioRoles, usuarios } from "../db/schema.js";
import { AuthQueries } from "../db/queries/auth.queries.js";
import { SecurityAuditService } from "../services/security-audit.service.js";

type AdminEstudioBody = {
  nombre?: string;
  cuit?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  emailAdmin?: string | null;
  nombreUsuario?: string;
  apellidoUsuario?: string;
  emailUsuario?: string;
  password?: string;
  driveFolderId?: string | null;
  planSuscripcionId?: number | null;
  plan?: string | null;
  maxUsuarios?: number | null;
  almacenamientoGb?: number | null;
};

type IdParams = {
  id: string;
};

type UsuarioParams = {
  id: string;
  usuarioId: string;
};

type AdminUsuarioBody = {
  nombre?: string;
  apellido?: string;
  email?: string;
  dni?: string | null;
  telefono?: string | null;
  password?: string;
  rol?: string;
};

type AdminRolBody = {
  codigo?: string;
  nombre?: string;
};

type AdminPermisoBody = {
  permisos?: Array<{
    modulo: string;
    ver: boolean;
    crear: boolean;
    editar: boolean;
    eliminar: boolean;
  }>;
};

type AdminPlanBody = {
  codigo?: string;
  nombre?: string;
  maxUsuarios?: number;
  almacenamientoGb?: number;
  precioMensualArs?: string | number;
  precioMensualJus?: string | number;
  activo?: boolean;
};

const MODULOS_PLATAFORMA = [
  "CLIENTES", "CASOS", "TAREAS", "EVENTOS", "HONORARIOS",
  "GASTOS", "INGRESOS", "PLANTILLAS", "NOTAS", "VALORJUS",
  "TERCEROS", "PLANES", "ADJUNTOS",
];

const ROLES_CRITICOS = ["SUPERADMIN", "ADMIN", "DIRECTOR"];
const PLATFORM_ESTUDIO_ID = 1;

export function isSuperRole(request: FastifyRequest) {
  const rol = String(request.authUser?.rol ?? "").toUpperCase();
  return request.authUser?.estudioId === PLATFORM_ESTUDIO_ID && (rol === "SUPERADMIN" || rol === "ADMIN");
}

export function forbidden(reply: FastifyReply) {
  return reply.status(403).send({
    error: { code: "FORBIDDEN", message: "Acceso reservado a administración global" },
  });
}

function serializeEstudio(row: typeof estudios.$inferSelect, stats?: { usuariosActivos?: number; clientesActivos?: number; expedientes?: number }) {
  return {
    id: row.id,
    nombre: row.nombre,
    cuit: row.cuit,
    telefono: row.telefono,
    emailContacto: row.emailContacto,
    emailAdmin: row.emailContacto,
    activo: row.activo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    usuariosActivos: stats?.usuariosActivos ?? 0,
    clientesActivos: stats?.clientesActivos ?? 0,
    expedientes: stats?.expedientes ?? 0,
    planSuscripcionId: row.planSuscripcionId,
    plan: row.plan ?? "SOLO",
    maxUsuarios: row.maxUsuarios ?? 1,
    almacenamientoGb: row.almacenamientoGb ?? 5,
    driveFolderId: row.driveFolderId,
  };
}

function normalizePlanCodigo(value?: string | null) {
  return String(value || "SOLO")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .toUpperCase();
}

async function findPlanSuscripcionByCodigo(codigo?: string | null) {
  const normalized = normalizePlanCodigo(codigo);
  const [plan] = await db
    .select()
    .from(planesSuscripcion)
    .where(and(eq(planesSuscripcion.codigo, normalized), eq(planesSuscripcion.activo, true)))
    .limit(1);

  return plan ?? null;
}

async function findPlanSuscripcionById(id?: number | null) {
  if (!id) return null;
  const [plan] = await db
    .select()
    .from(planesSuscripcion)
    .where(and(eq(planesSuscripcion.id, id), eq(planesSuscripcion.activo, true)))
    .limit(1);

  return plan ?? null;
}

function serializePlanSuscripcion(row: typeof planesSuscripcion.$inferSelect) {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    maxUsuarios: row.maxUsuarios,
    almacenamientoGb: row.almacenamientoGb,
    precioMensualArs: row.precioMensualArs,
    precioMensualJus: row.precioMensualJus,
    activo: row.activo,
    createdAt: row.createdAt,
  };
}

function normalizeDecimalInput(value: string | number | undefined, fallback?: string) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).replace(",", ".").trim();
  return Number.isFinite(Number(normalized)) ? normalized : fallback;
}

function buildPlanPayload(body: AdminPlanBody, current?: typeof planesSuscripcion.$inferSelect) {
  const codigo = body.codigo !== undefined ? normalizePlanCodigo(body.codigo) : current?.codigo;
  const nombre = body.nombre !== undefined ? body.nombre.trim() : current?.nombre;
  const maxUsuarios = body.maxUsuarios !== undefined ? Number(body.maxUsuarios) : current?.maxUsuarios;
  const almacenamientoGb = body.almacenamientoGb !== undefined ? Number(body.almacenamientoGb) : current?.almacenamientoGb;
  const precioMensualArs = normalizeDecimalInput(body.precioMensualArs, current?.precioMensualArs);
  const precioMensualJus = normalizeDecimalInput(body.precioMensualJus, current?.precioMensualJus ?? "0.0000");

  if (!codigo || !nombre || !maxUsuarios || maxUsuarios <= 0 || !almacenamientoGb || almacenamientoGb <= 0 || !precioMensualArs || !precioMensualJus) {
    return null;
  }

  return {
    codigo,
    nombre,
    maxUsuarios,
    almacenamientoGb,
    precioMensualArs,
    precioMensualJus,
    activo: body.activo ?? current?.activo ?? true,
  };
}

async function getStats(estudioId: number) {
  const [[usuariosRow], [clientesRow], [casosRow]] = await Promise.all([
    db
      .select({ total: count() })
      .from(usuarios)
      .where(and(eq(usuarios.estudioId, estudioId), eq(usuarios.activo, true), isNull(usuarios.deletedAt))),
    db
      .select({ total: count() })
      .from(clientes)
      .where(and(eq(clientes.estudioId, estudioId), eq(clientes.activo, true), isNull(clientes.deletedAt))),
    db
      .select({ total: count() })
      .from(casos)
      .where(and(eq(casos.estudioId, estudioId), eq(casos.activo, true), isNull(casos.deletedAt))),
  ]);

  return {
    usuariosActivos: Number(usuariosRow?.total ?? 0),
    clientesActivos: Number(clientesRow?.total ?? 0),
    expedientes: Number(casosRow?.total ?? 0),
  };
}

function parseId(value: string) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function ensureTenantEstudio(id: number) {
  if (id === 1) return null;
  const [row] = await db.select().from(estudios).where(and(eq(estudios.id, id), ne(estudios.id, 1))).limit(1);
  return row ?? null;
}

function roleName(codigo: string) {
  const map: Record<string, string> = {
    DIRECTOR: "Director",
    ABOGADO: "Abogado",
    ASISTENTE: "Asistente",
    ASESOR_FINANCIERO: "Asesor Financiero",
  };
  return map[codigo] ?? codigo;
}

function normalizeRoleCode(value?: string) {
  return String(value || "ABOGADO")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function isCriticalRole(codigo?: string | null) {
  return ROLES_CRITICOS.includes(String(codigo ?? "").toUpperCase());
}

function normalizeRolCodigo(value?: string) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function defaultPermisos() {
  return MODULOS_PLATAFORMA.map((modulo) => ({
    modulo,
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  }));
}

async function usuariosCountByRol(rolId: number) {
  const [row] = await db.select({ total: count() }).from(usuarioRoles).where(eq(usuarioRoles.rolId, rolId));
  return Number(row?.total ?? 0);
}

async function serializeRol(row: typeof roles.$inferSelect) {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    activo: row.activo,
    usuariosCount: await usuariosCountByRol(row.id),
  };
}

async function findOrCreateRole(codigo: string) {
  const normalized = normalizeRoleCode(codigo);
  const [role] = await db.select().from(roles).where(eq(roles.codigo, normalized)).limit(1);
  if (role) return role;
  const [created] = await db.insert(roles).values({ codigo: normalized, nombre: roleName(normalized) }).returning();
  return created;
}

async function replaceUserRole(usuarioId: number, rol?: string) {
  if (!rol) return;
  const role = await findOrCreateRole(rol);
  if (["SUPERADMIN", "ADMIN"].includes(String(role.codigo).toUpperCase())) {
    throw new Error("PLATFORM_ROLE_FORBIDDEN");
  }
  await db.delete(usuarioRoles).where(eq(usuarioRoles.usuarioId, usuarioId));
  await db.insert(usuarioRoles).values({ usuarioId, rolId: role.id });
  await bumpUserTokenVersion(usuarioId);
}

async function auditRoleChange(request: FastifyRequest, usuarioId: number, rol?: string, targetEstudioId?: number | null) {
  if (!rol) return;
  await SecurityAuditService.log({
    evento: "ROLE_CHANGE",
    request,
    targetEstudioId,
    metadata: { targetUsuarioId: usuarioId, rol: normalizeRoleCode(rol) },
  });
}

async function bumpUserTokenVersion(usuarioId: number) {
  await db.update(usuarios).set({ tokenVersion: sql`${usuarios.tokenVersion} + 1` }).where(eq(usuarios.id, usuarioId));
}

async function bumpUsersWithRole(rolId: number) {
  const rows = await db.select({ usuarioId: usuarioRoles.usuarioId }).from(usuarioRoles).where(eq(usuarioRoles.rolId, rolId));
  if (rows.length === 0) return;
  await Promise.all(rows.map((row) => bumpUserTokenVersion(row.usuarioId)));
}

async function getUserRoles(usuarioId: number) {
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
    roles: await getUserRoles(row.id),
  };
}

export async function listarEstudios(request: FastifyRequest, reply: FastifyReply) {

  // Filtrar para excluir el Estudio del Sistema (ID 1)
  const rows = await db.select().from(estudios).where(ne(estudios.id, 1)).orderBy(desc(estudios.createdAt));
  const data = await Promise.all(rows.map(async (row) => serializeEstudio(row, await getStats(row.id))));
  return reply.send({ data });
}

export async function obtenerEstudio(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {

  const id = Number(request.params.id);
  if (!Number.isFinite(id) || id === 1) {
    return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });
  }

  const [row] = await db.select().from(estudios).where(and(eq(estudios.id, id), ne(estudios.id, 1))).limit(1);
  if (!row) {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Estudio no encontrado" } });
  }

  return reply.send({ data: serializeEstudio(row, await getStats(row.id)) });
}

export async function crearEstudio(request: FastifyRequest<{ Body: AdminEstudioBody }>, reply: FastifyReply) {

  const body = request.body ?? {};
  const nombre = body.nombre?.trim();
  const emailContacto = (body.emailContacto ?? body.emailAdmin ?? body.emailUsuario)?.trim();
  const emailUsuario = (body.emailUsuario ?? body.emailAdmin ?? body.emailContacto)?.trim();

  if (!nombre || !emailContacto || !emailUsuario || !body.password) {
    return reply.status(400).send({
      error: {
        code: "BAD_REQUEST",
        message: "nombre, emailContacto/emailAdmin, emailUsuario y password son requeridos",
      },
    });
  }

  const existing = await AuthQueries.findUserByEmail(emailUsuario);
  if (existing) {
    return reply.status(409).send({ error: { code: "EMAIL_IN_USE", message: "El email del administrador ya está registrado" } });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const nombreUsuario = body.nombreUsuario?.trim() || nombre;
  const apellidoUsuario = body.apellidoUsuario?.trim() || "Administrador";
  const plan = await findPlanSuscripcionByCodigo(body.plan);
  if (!plan) {
    return reply.status(400).send({ error: { code: "PLAN_NOT_FOUND", message: "Plan de suscripción inválido" } });
  }

  const { nuevoEstudio } = await AuthQueries.createTenantWithAdmin(
    nombre,
    {
      nombre: nombreUsuario,
      apellido: apellidoUsuario,
      email: emailUsuario,
      passwordHash,
    },
    {
      cuit: body.cuit?.trim() || null,
      telefono: body.telefono?.trim() || null,
      emailContacto,
      driveFolderId: body.driveFolderId?.trim() || null,
      planSuscripcionId: plan.id,
      plan: plan.codigo,
      maxUsuarios: body.maxUsuarios ?? plan.maxUsuarios,
      almacenamientoGb: body.almacenamientoGb ?? plan.almacenamientoGb,
    }
  );

  return reply.status(201).send({ data: serializeEstudio(nuevoEstudio, await getStats(nuevoEstudio.id)) });
}

export async function actualizarEstudio(request: FastifyRequest<{ Params: IdParams; Body: AdminEstudioBody }>, reply: FastifyReply) {

  const id = Number(request.params.id);
  if (!Number.isFinite(id) || id === 1) {
    return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });
  }

  const body = request.body ?? {};
  const updateData: Partial<typeof estudios.$inferInsert> = { updatedAt: new Date() };
  if (body.nombre !== undefined) updateData.nombre = body.nombre.trim();
  if (body.cuit !== undefined) updateData.cuit = body.cuit?.trim() || null;
  if (body.telefono !== undefined) updateData.telefono = body.telefono?.trim() || null;
  if (body.emailContacto !== undefined || body.emailAdmin !== undefined) {
    updateData.emailContacto = (body.emailContacto ?? body.emailAdmin)?.trim() || null;
  }
  if (body.driveFolderId !== undefined) {
    updateData.driveFolderId = body.driveFolderId?.trim() || null;
  }
  if (body.plan !== undefined) {
    const plan = await findPlanSuscripcionByCodigo(body.plan);
    if (!plan) {
      return reply.status(400).send({ error: { code: "PLAN_NOT_FOUND", message: "Plan de suscripción inválido" } });
    }
    updateData.planSuscripcionId = plan.id;
    updateData.plan = plan.codigo;
    updateData.maxUsuarios = body.maxUsuarios ?? plan.maxUsuarios;
    updateData.almacenamientoGb = body.almacenamientoGb ?? plan.almacenamientoGb;
  } else if (body.planSuscripcionId !== undefined) {
    const plan = await findPlanSuscripcionById(body.planSuscripcionId);
    if (!plan) {
      return reply.status(400).send({ error: { code: "PLAN_NOT_FOUND", message: "Plan de suscripción inválido" } });
    }
    updateData.planSuscripcionId = plan.id;
    updateData.plan = plan.codigo;
    updateData.maxUsuarios = body.maxUsuarios ?? plan.maxUsuarios;
    updateData.almacenamientoGb = body.almacenamientoGb ?? plan.almacenamientoGb;
  } else {
    if (body.maxUsuarios !== undefined) updateData.maxUsuarios = body.maxUsuarios ?? 1;
    if (body.almacenamientoGb !== undefined) updateData.almacenamientoGb = body.almacenamientoGb ?? 5;
  }

  const [updated] = await db.update(estudios).set(updateData).where(and(eq(estudios.id, id), ne(estudios.id, 1))).returning();
  if (!updated) {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Estudio no encontrado" } });
  }

  return reply.send({ data: serializeEstudio(updated, await getStats(updated.id)) });
}

export async function toggleEstudio(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {

  const id = Number(request.params.id);
  if (!Number.isFinite(id) || id === 1) {
    return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });
  }

  const [current] = await db.select().from(estudios).where(and(eq(estudios.id, id), ne(estudios.id, 1))).limit(1);
  if (!current) {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Estudio no encontrado" } });
  }

  const [updated] = await db
    .update(estudios)
    .set({ activo: !current.activo, updatedAt: new Date() })
    .where(and(eq(estudios.id, id), ne(estudios.id, 1)))
    .returning();

  return reply.send({ data: serializeEstudio(updated, await getStats(updated.id)) });
}

export async function listarPlanesSuscripcion(request: FastifyRequest, reply: FastifyReply) {

  const rows = await db.select().from(planesSuscripcion).orderBy(asc(planesSuscripcion.id));
  return reply.send({ data: rows.map(serializePlanSuscripcion) });
}

export async function obtenerPlanSuscripcion(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {

  const id = parseId(request.params.id);
  if (!id) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });

  const [row] = await db.select().from(planesSuscripcion).where(eq(planesSuscripcion.id, id)).limit(1);
  if (!row) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Plan no encontrado" } });

  return reply.send({ data: serializePlanSuscripcion(row) });
}

export async function crearPlanSuscripcion(request: FastifyRequest<{ Body: AdminPlanBody }>, reply: FastifyReply) {

  const payload = buildPlanPayload(request.body ?? {});
  if (!payload) {
    return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Completá código, nombre, límites y precios válidos" } });
  }

  const [existing] = await db.select({ id: planesSuscripcion.id }).from(planesSuscripcion).where(eq(planesSuscripcion.codigo, payload.codigo)).limit(1);
  if (existing) {
    return reply.status(409).send({ error: { code: "PLAN_EXISTS", message: "Ya existe un plan con ese código" } });
  }

  const [created] = await db.insert(planesSuscripcion).values(payload).returning();
  return reply.status(201).send({ data: serializePlanSuscripcion(created) });
}

export async function actualizarPlanSuscripcion(request: FastifyRequest<{ Params: IdParams; Body: AdminPlanBody }>, reply: FastifyReply) {

  const id = parseId(request.params.id);
  if (!id) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });

  const [current] = await db.select().from(planesSuscripcion).where(eq(planesSuscripcion.id, id)).limit(1);
  if (!current) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Plan no encontrado" } });

  const payload = buildPlanPayload(request.body ?? {}, current);
  if (!payload) {
    return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Completá código, nombre, límites y precios válidos" } });
  }

  const [owner] = await db.select({ id: planesSuscripcion.id })
    .from(planesSuscripcion)
    .where(and(eq(planesSuscripcion.codigo, payload.codigo), ne(planesSuscripcion.id, id)))
    .limit(1);
  if (owner) {
    return reply.status(409).send({ error: { code: "PLAN_EXISTS", message: "Ya existe un plan con ese código" } });
  }

  const [updated] = await db.update(planesSuscripcion).set(payload).where(eq(planesSuscripcion.id, id)).returning();
  return reply.send({ data: serializePlanSuscripcion(updated) });
}

export async function togglePlanSuscripcion(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {

  const id = parseId(request.params.id);
  if (!id) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });

  const [current] = await db.select().from(planesSuscripcion).where(eq(planesSuscripcion.id, id)).limit(1);
  if (!current) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Plan no encontrado" } });

  const [updated] = await db.update(planesSuscripcion).set({ activo: !current.activo }).where(eq(planesSuscripcion.id, id)).returning();
  return reply.send({ data: serializePlanSuscripcion(updated) });
}

export async function listarUsuariosEstudio(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {

  const estudioId = parseId(request.params.id);
  if (!estudioId) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });
  const estudio = await ensureTenantEstudio(estudioId);
  if (!estudio) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Estudio no encontrado" } });

  const rows = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.estudioId, estudioId), isNull(usuarios.deletedAt)))
    .orderBy(desc(usuarios.createdAt));

  return reply.send({ data: await Promise.all(rows.map(serializeUsuario)) });
}

export async function crearUsuarioEstudio(request: FastifyRequest<{ Params: IdParams; Body: AdminUsuarioBody }>, reply: FastifyReply) {

  const estudioId = parseId(request.params.id);
  if (!estudioId) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });
  const estudio = await ensureTenantEstudio(estudioId);
  if (!estudio) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Estudio no encontrado" } });

  const body = request.body ?? {};
  const nombre = body.nombre?.trim();
  const apellido = body.apellido?.trim();
  const email = body.email?.trim().toLowerCase();
  if (!nombre || !apellido || !email || !body.password) {
    return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "nombre, apellido, email y password son requeridos" } });
  }

  const stats = await getStats(estudioId);
  const maxUsuarios = serializeEstudio(estudio).maxUsuarios;
  if (maxUsuarios && stats.usuariosActivos >= maxUsuarios) {
    return reply.status(400).send({
      error: { code: "LIMIT_EXCEEDED", message: `El estudio superó el límite máximo de ${maxUsuarios} usuarios de su plan.` },
    });
  }

  const existing = await AuthQueries.findUserByEmail(email);
  if (existing) return reply.status(409).send({ error: { code: "EMAIL_IN_USE", message: "El email ya está registrado" } });

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
    })
    .returning();

  await replaceUserRole(created.id, body.rol || "ABOGADO");
  await SecurityAuditService.log({
    evento: "USER_CREATE",
    request,
    targetEstudioId: estudioId,
    metadata: { targetUsuarioId: created.id, rol: normalizeRoleCode(body.rol || "ABOGADO") },
  });
  return reply.status(201).send({ data: await serializeUsuario(created) });
}

export async function actualizarUsuarioEstudio(request: FastifyRequest<{ Params: UsuarioParams; Body: AdminUsuarioBody }>, reply: FastifyReply) {

  const estudioId = parseId(request.params.id);
  const usuarioId = parseId(request.params.usuarioId);
  if (!estudioId || !usuarioId) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });

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
    const [emailOwner] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.email, email), ne(usuarios.id, usuarioId)))
      .limit(1);
    if (emailOwner) return reply.status(409).send({ error: { code: "EMAIL_IN_USE", message: "El email ya está registrado" } });
    updateData.email = email;
  }
  const nextPassword = body.password?.trim();
  const shouldBumpTokenVersion = Boolean(nextPassword);
  if (nextPassword) {
    updateData.passwordHash = await bcrypt.hash(nextPassword, 12);
  }

  const [updated] = await db
    .update(usuarios)
    .set(updateData)
    .where(and(eq(usuarios.id, usuarioId), eq(usuarios.estudioId, estudioId), isNull(usuarios.deletedAt)))
    .returning();

  if (shouldBumpTokenVersion) await bumpUserTokenVersion(usuarioId);
  if (body.rol) {
    await replaceUserRole(usuarioId, body.rol);
    await auditRoleChange(request, usuarioId, body.rol, estudioId);
  }
  return reply.send({ data: await serializeUsuario(updated) });
}

export async function toggleUsuarioEstudio(request: FastifyRequest<{ Params: UsuarioParams }>, reply: FastifyReply) {

  const estudioId = parseId(request.params.id);
  const usuarioId = parseId(request.params.usuarioId);
  if (!estudioId || !usuarioId) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });

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

export async function eliminarUsuarioEstudio(request: FastifyRequest<{ Params: UsuarioParams }>, reply: FastifyReply) {

  const estudioId = parseId(request.params.id);
  const usuarioId = parseId(request.params.usuarioId);
  if (!estudioId || !usuarioId) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });

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

  return reply.send({ data: { message: "Usuario eliminado" } });
}

export async function listarRoles(request: FastifyRequest, reply: FastifyReply) {

  const rows = await db.select().from(roles).orderBy(asc(roles.nombre));
  return reply.send({ data: await Promise.all(rows.map(serializeRol)) });
}

export async function obtenerRolConPermisos(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {

  const id = parseId(request.params.id);
  if (!id) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });

  const [rol] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!rol) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Rol no encontrado" } });

  const rows = await db.select().from(permisos).where(eq(permisos.rolId, id)).orderBy(asc(permisos.modulo));
  const permisosRol = rows.length
    ? rows.map((p) => ({ modulo: p.modulo, ver: p.ver, crear: p.crear, editar: p.editar, eliminar: p.eliminar }))
    : defaultPermisos();

  return reply.send({ data: { ...(await serializeRol(rol)), permisos: permisosRol } });
}

export async function crearRol(request: FastifyRequest<{ Body: AdminRolBody }>, reply: FastifyReply) {

  const codigo = normalizeRolCodigo(request.body?.codigo);
  const nombre = request.body?.nombre?.trim();
  if (!codigo || !nombre) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "codigo y nombre son requeridos" } });

  const [existing] = await db.select().from(roles).where(eq(roles.codigo, codigo)).limit(1);
  if (existing) return reply.status(409).send({ error: { code: "ROLE_EXISTS", message: "El código de rol ya existe" } });

  const created = await db.transaction(async (tx) => {
    const [rol] = await tx.insert(roles).values({ codigo, nombre }).returning();
    await tx.insert(permisos).values(defaultPermisos().map((p) => ({ ...p, rolId: rol.id })));
    return rol;
  });

  return reply.status(201).send({ data: await serializeRol(created) });
}

export async function actualizarRol(request: FastifyRequest<{ Params: IdParams; Body: AdminRolBody }>, reply: FastifyReply) {

  const id = parseId(request.params.id);
  if (!id) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });

  const [current] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!current) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Rol no encontrado" } });

  const updateData: Partial<typeof roles.$inferInsert> = {};
  if (request.body?.nombre !== undefined) updateData.nombre = request.body.nombre.trim();
  if (request.body?.codigo !== undefined) {
    if (isCriticalRole(current.codigo)) {
      return reply.status(400).send({ error: { code: "PROTECTED_ROLE", message: "No se puede modificar el código de un rol protegido" } });
    }
    const codigo = normalizeRolCodigo(request.body.codigo);
    const [owner] = await db.select({ id: roles.id }).from(roles).where(and(eq(roles.codigo, codigo), ne(roles.id, id))).limit(1);
    if (owner) return reply.status(409).send({ error: { code: "ROLE_EXISTS", message: "El código de rol ya existe" } });
    updateData.codigo = codigo;
  }

  const [updated] = await db.update(roles).set(updateData).where(eq(roles.id, id)).returning();
  await bumpUsersWithRole(id);
  return reply.send({ data: await serializeRol(updated) });
}

export async function actualizarPermisosRol(request: FastifyRequest<{ Params: IdParams; Body: AdminPermisoBody }>, reply: FastifyReply) {

  const id = parseId(request.params.id);
  if (!id) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });
  const [rol] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!rol) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Rol no encontrado" } });

  const rows = Array.isArray(request.body?.permisos) ? request.body.permisos : [];
  await db.transaction(async (tx) => {
    await tx.delete(permisos).where(eq(permisos.rolId, id));
    if (rows.length) {
      await tx.insert(permisos).values(rows.map((p) => ({
        rolId: id,
        modulo: normalizeRolCodigo(p.modulo),
        ver: Boolean(p.ver),
        crear: Boolean(p.crear),
        editar: Boolean(p.editar),
        eliminar: Boolean(p.eliminar),
      })));
    }
  });
  await bumpUsersWithRole(id);
  await SecurityAuditService.log({
    evento: "PERMISSION_CHANGE",
    request,
    metadata: { rolId: id, permisosCount: rows.length },
  });

  return reply.send({ data: { message: "Permisos actualizados" } });
}

export async function toggleRol(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {

  const id = parseId(request.params.id);
  if (!id) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });
  const [current] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!current) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Rol no encontrado" } });
  if (isCriticalRole(current.codigo)) {
    return reply.status(400).send({ error: { code: "PROTECTED_ROLE", message: "No se puede desactivar un rol protegido" } });
  }

  const [updated] = await db.update(roles).set({ activo: !current.activo }).where(eq(roles.id, id)).returning();
  await bumpUsersWithRole(id);
  return reply.send({ data: await serializeRol(updated) });
}

export async function eliminarRol(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {

  const id = parseId(request.params.id);
  if (!id) return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "ID inválido" } });
  const [current] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!current) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Rol no encontrado" } });
  if (isCriticalRole(current.codigo)) {
    return reply.status(400).send({ error: { code: "PROTECTED_ROLE", message: "No se puede eliminar un rol protegido" } });
  }
  const assigned = await usuariosCountByRol(id);
  if (assigned > 0) {
    return reply.status(409).send({ error: { code: "ROLE_IN_USE", message: "El rol está asignado a usuarios" } });
  }

  await db.transaction(async (tx) => {
    await tx.delete(permisos).where(eq(permisos.rolId, id));
    await tx.delete(roles).where(eq(roles.id, id));
  });
  return reply.send({ data: { message: "Rol eliminado" } });
}
