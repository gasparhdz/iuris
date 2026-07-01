import { pgTable, serial, varchar, boolean, timestamp, integer, text, decimal, json, uniqueIndex, index, uuid, foreignKey, unique, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ==========================================
// 1. CORE & TENANT
// ==========================================
export const planesSuscripcion = pgTable("planes_suscripcion", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 50 }).unique().notNull(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  maxUsuarios: integer("max_usuarios").notNull(),
  almacenamientoGb: integer("almacenamiento_gb").notNull(),
  precioMensualArs: decimal("precio_mensual_ars", { precision: 14, scale: 2 }).notNull(),
  precioMensualJus: decimal("precio_mensual_jus", { precision: 14, scale: 4 }).notNull(),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const estudios = pgTable("estudios", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  planSuscripcionId: integer("plan_suscripcion_id").references(() => planesSuscripcion.id),
  plan: varchar("plan", { length: 50 }).default("SOLO").notNull(),
  maxUsuarios: integer("max_usuarios").default(1).notNull(),
  almacenamientoGb: integer("almacenamiento_gb").default(5).notNull(),
  cuit: varchar("cuit", { length: 50 }),
  dirCalle: varchar("dir_calle", { length: 255 }),
  dirNro: varchar("dir_nro", { length: 50 }),
  dirPiso: varchar("dir_piso", { length: 50 }),
  dirDepto: varchar("dir_depto", { length: 50 }),
  codigoPostal: varchar("codigo_postal", { length: 20 }),
  provinciaId: integer("provincia_id").references(() => provincias.id),
  localidadId: integer("localidad_id").references(() => localidades.id),
  telefono: varchar("telefono", { length: 50 }),
  emailContacto: varchar("email_contacto", { length: 255 }),
  logoUrl: varchar("logo_url", { length: 500 }),
  driveFolderId: varchar("drive_folder_id", { length: 255 }),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==========================================
// 2. PARÁMETROS Y CATEGORÍAS
// ==========================================
export const categorias = pgTable("categorias", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 50 }).unique().notNull(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  descripcion: text("descripcion"),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const parametros = pgTable("parametros", {
  id: serial("id").primaryKey(),
  categoriaId: integer("categoria_id").references(() => categorias.id).notNull(),
  parentId: integer("parent_id"), // Auto-referencia
  codigo: varchar("codigo", { length: 50 }).notNull(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  orden: integer("orden").default(0).notNull(),
  activo: boolean("activo").default(true).notNull(),
  extra: json("extra"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


export const valoresJus = pgTable("valores_jus", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  valor: decimal("valor", { precision: 14, scale: 4 }).notNull(),
  fecha: timestamp("fecha").notNull(),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  uniqueIndex("valores_jus_estudio_fecha_unique").on(table.estudioId, table.fecha),
]);

// ==========================================
// 3. GEOGRAFÍA
// ==========================================
export const paises = pgTable("paises", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  codigoIso: varchar("codigo_iso", { length: 10 }),
});

export const provincias = pgTable("provincias", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  paisId: integer("pais_id").references(() => paises.id).notNull(),
});

export const localidades = pgTable("localidades", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  provinciaId: integer("provincia_id").references(() => provincias.id).notNull(),
});

export const codigosPostales = pgTable("codigos_postales", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 20 }).notNull(),
  localidadId: integer("localidad_id").references(() => localidades.id).notNull(),
});

// ==========================================
// 4. USUARIOS, ROLES Y AUTH
// ==========================================
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 50 }).unique().notNull(), // SUPERADMIN, ADMIN, DIRECTOR, ABOGADO, ASISTENTE
  nombre: varchar("nombre", { length: 100 }).notNull(),
  activo: boolean("activo").default(true).notNull(),
});

export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  apellido: varchar("apellido", { length: 100 }).notNull(),
  dni: varchar("dni", { length: 50 }),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  telefono: varchar("telefono", { length: 50 }),
  activo: boolean("activo").default(true).notNull(),
  tokenVersion: integer("token_version").default(0).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  mustChangePass: boolean("must_change_pass").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const usuarioRoles = pgTable("usuario_roles", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").references(() => usuarios.id).notNull(),
  rolId: integer("rol_id").references(() => roles.id).notNull(),
});

export const permisos = pgTable("permisos", {
  id: serial("id").primaryKey(),
  rolId: integer("rol_id").references(() => roles.id).notNull(),
  modulo: varchar("modulo", { length: 100 }).notNull(),
  ver: boolean("ver").default(false).notNull(),
  crear: boolean("crear").default(false).notNull(),
  editar: boolean("editar").default(false).notNull(),
  eliminar: boolean("eliminar").default(false).notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").references(() => usuarios.id).notNull(),
  jtiHash: varchar("jti_hash", { length: 64 }),
  familyId: uuid("family_id"),
  userAgent: varchar("user_agent", { length: 255 }),
  ip: varchar("ip", { length: 50 }),
  expiresAt: timestamp("expires_at").notNull(),
  rotatedAt: timestamp("rotated_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("refresh_tokens_jti_hash_unique").on(table.jtiHash),
  index("refresh_tokens_family_id_idx").on(table.familyId),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").references(() => usuarios.id).notNull(),
  tokenHash: varchar("token_hash", { length: 500 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sisfeSessions = pgTable("sisfe_sessions", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").references(() => usuarios.id, { onDelete: "cascade" }).notNull(),
  estudioId: integer("estudio_id").references(() => estudios.id, { onDelete: "cascade" }).notNull(),
  sessionCookieEncriptada: text("session_cookie_encriptada").notNull(),
  cookieName: varchar("cookie_name", { length: 100 }).notNull(),
  // Matrícula SISFE del usuario logueado (ej: "LIII043"), leída de la barra superior
  // al iniciar sesión. Sirve para descartar de las novedades los movimientos que el
  // propio usuario presentó (la observación incluye "Presentante: ... - <matrícula>").
  sisfeMatricula: varchar("sisfe_matricula", { length: 50 }),
  lastVerifiedAt: timestamp("last_verified_at"),
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: varchar("sync_status", { length: 20 }).default("idle").notNull(),
  syncProgress: integer("sync_progress").default(0).notNull(),
  syncMessage: text("sync_message"),
  syncStats: json("sync_stats"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("sisfe_sessions_usuario_unique").on(table.usuarioId),
]);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  usuarioId: integer("usuario_id").references(() => usuarios.id, { onDelete: "cascade" }).notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: varchar("user_agent", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
}, (table) => [
  uniqueIndex("push_subscriptions_endpoint_unico").on(table.endpoint),
  index("push_subscriptions_usuario_idx").on(table.usuarioId),
]);

// ==========================================
// 5. CLIENTES Y TERCEROS
// ==========================================
export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  tipoPersonaId: integer("tipo_persona_id").references(() => parametros.id).notNull(),
  nombre: varchar("nombre", { length: 100 }),
  apellido: varchar("apellido", { length: 100 }),
  razonSocial: varchar("razon_social", { length: 255 }),
  dni: varchar("dni", { length: 50 }),
  cuit: varchar("cuit", { length: 50 }),
  fechaNacimiento: timestamp("fecha_nacimiento"),
  email: varchar("email", { length: 255 }),
  telFijo: varchar("tel_fijo", { length: 50 }),
  telCelular: varchar("tel_celular", { length: 50 }),
  dirCalle: varchar("dir_calle", { length: 255 }),
  dirNro: varchar("dir_nro", { length: 50 }),
  dirPiso: varchar("dir_piso", { length: 50 }),
  dirDepto: varchar("dir_depto", { length: 50 }),
  codigoPostal: varchar("codigo_postal", { length: 20 }),
  provinciaId: integer("provincia_id").references(() => provincias.id),
  localidadId: integer("localidad_id").references(() => localidades.id),
  observaciones: text("observaciones"),
  activo: boolean("activo").default(true).notNull(),
  driveFolderId: varchar("drive_folder_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
  updatedAt: timestamp("updated_at"),
  updatedBy: integer("updated_by").references(() => usuarios.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by").references(() => usuarios.id),
}, (table) => [
  unique("clientes_id_estudio_id_unique").on(table.id, table.estudioId),
  index("clientes_estudio_created_idx")
    .on(table.estudioId, table.createdAt)
    .where(sql`${table.deletedAt} IS NULL`),
]);

export const contactosClientes = pgTable("contactos_clientes", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id, { onDelete: "cascade" }).notNull(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  rol: varchar("rol", { length: 100 }),
  email: varchar("email", { length: 255 }),
  telefono: varchar("telefono", { length: 50 }),
  observaciones: text("observaciones"),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
  updatedAt: timestamp("updated_at"),
  updatedBy: integer("updated_by").references(() => usuarios.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by").references(() => usuarios.id),
});

export const terceros = pgTable("terceros", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  tipoPersonaId: integer("tipo_persona_id").references(() => parametros.id).notNull(),
  nombre: varchar("nombre", { length: 100 }),
  apellido: varchar("apellido", { length: 100 }),
  razonSocial: varchar("razon_social", { length: 255 }),
  dni: varchar("dni", { length: 50 }),
  cuit: varchar("cuit", { length: 50 }),
  fechaNacimiento: timestamp("fecha_nacimiento"),
  email: varchar("email", { length: 255 }),
  telefono: varchar("telefono", { length: 50 }),
  dirCalle: varchar("dir_calle", { length: 255 }),
  dirNro: varchar("dir_nro", { length: 50 }),
  dirPiso: varchar("dir_piso", { length: 50 }),
  dirDepto: varchar("dir_depto", { length: 50 }),
  codigoPostal: varchar("codigo_postal", { length: 20 }),
  provinciaId: integer("provincia_id").references(() => provincias.id),
  localidadId: integer("localidad_id").references(() => localidades.id),
  observaciones: text("observaciones"),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
  updatedAt: timestamp("updated_at"),
  updatedBy: integer("updated_by").references(() => usuarios.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by").references(() => usuarios.id),
}, (table) => [
  // Invariante tenant: permite FK compuestas (id, estudio_id) desde tablas hijas.
  unique("terceros_id_estudio_id_unique").on(table.id, table.estudioId),
]);

// ==========================================
// 6. CASOS Y EXPEDIENTES
// ==========================================
export const casos = pgTable("casos", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  clienteId: integer("cliente_id").notNull(),
  nroExpte: varchar("nro_expte", { length: 100 }),
  nroExpteNorm: varchar("nro_expte_norm", { length: 100 }),
  sisfeExpteId: varchar("sisfe_expte_id", { length: 50 }),
  sisfeLastSyncAt: timestamp("sisfe_last_sync_at"),
  sisfeSyncedBy: integer("sisfe_synced_by").references(() => usuarios.id),
  sisfeRadicadoEn: varchar("sisfe_radicado_en", { length: 500 }),
  sisfeLocalidad: varchar("sisfe_localidad", { length: 255 }),
  sisfeFechaIngresoMeu: timestamp("sisfe_fecha_ingreso_meu"),
  sisfeUbicacionActual: varchar("sisfe_ubicacion_actual", { length: 500 }),
  sisfeFechaUbicacionActual: timestamp("sisfe_fecha_ubicacion_actual"),
  sisfeSoloDigital: boolean("sisfe_solo_digital"),
  sisfeFechaUltimaActualizacion: timestamp("sisfe_fecha_ultima_actualizacion"),
  // Fecha del último expediente digital (PDF consolidado) descargado con éxito.
  // Junto con sisfeFechaUltimaActualizacion permite saltear la descarga del PDF
  // cuando el expediente no tuvo novedades desde el último sync.
  sisfeExpedienteDigitalAt: timestamp("sisfe_expediente_digital_at"),
  caratula: varchar("caratula", { length: 500 }),
  tipoId: integer("tipo_id").references(() => parametros.id).notNull(),
  descripcion: text("descripcion"),
  estadoId: integer("estado_id").references(() => parametros.id),
  fechaEstado: timestamp("fecha_estado").defaultNow().notNull(),
  radicacionId: integer("radicacion_id").references(() => parametros.id),
  estadoRadicacionId: integer("estado_radicacion_id").references(() => parametros.id),
  fechaEstadoRadicacion: timestamp("fecha_estado_radicacion"),
  responsableId: integer("responsable_id").references(() => usuarios.id),
  driveFolderId: varchar("drive_folder_id", { length: 255 }),
  numeroDrive: integer("numero_drive"),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
  updatedAt: timestamp("updated_at"),
  updatedBy: integer("updated_by").references(() => usuarios.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by").references(() => usuarios.id),
}, (table) => [
  unique("casos_id_estudio_id_unique").on(table.id, table.estudioId),
  foreignKey({
    name: "casos_cliente_estudio_fk",
    columns: [table.clienteId, table.estudioId],
    foreignColumns: [clientes.id, clientes.estudioId],
  }),
  index("casos_estudio_created_idx")
    .on(table.estudioId, table.createdAt)
    .where(sql`${table.deletedAt} IS NULL`),
  index("casos_estudio_cliente_idx")
    .on(table.estudioId, table.clienteId)
    .where(sql`${table.deletedAt} IS NULL`),
  index("casos_cliente_id_idx").on(table.clienteId),
  index("casos_responsable_id_idx").on(table.responsableId),
]);

export const casoTrazabilidad = pgTable("caso_trazabilidad", {
  id: serial("id").primaryKey(),
  casoId: integer("caso_id").notNull(),
  estudioId: integer("estudio_id").references(() => estudios.id, { onDelete: "cascade" }).notNull(),
  ubicacion: varchar("ubicacion", { length: 500 }).notNull(),
  fechaDesde: timestamp("fecha_desde").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  foreignKey({
    name: "caso_trazabilidad_caso_estudio_fk",
    columns: [table.casoId, table.estudioId],
    foreignColumns: [casos.id, casos.estudioId],
  }).onDelete("cascade"),
]);

export const casoTrazabilidadRelations = relations(casoTrazabilidad, ({ one }) => ({
  caso: one(casos, {
    fields: [casoTrazabilidad.casoId],
    references: [casos.id],
  }),
  estudio: one(estudios, {
    fields: [casoTrazabilidad.estudioId],
    references: [estudios.id],
  }),
}));

export const participantesCaso = pgTable("participantes_caso", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  casoId: integer("caso_id").notNull(),
  terceroId: integer("tercero_id").notNull(),
  rolId: integer("rol_id").references(() => parametros.id),
  observaciones: text("observaciones"),
}, (table) => [
  // Invariante tenant: el caso y el tercero deben pertenecer al mismo estudio.
  foreignKey({
    name: "participantes_caso_caso_estudio_fk",
    columns: [table.casoId, table.estudioId],
    foreignColumns: [casos.id, casos.estudioId],
  }).onDelete("cascade"),
  foreignKey({
    name: "participantes_caso_tercero_estudio_fk",
    columns: [table.terceroId, table.estudioId],
    foreignColumns: [terceros.id, terceros.estudioId],
  }),
  index("participantes_caso_estudio_caso_idx").on(table.estudioId, table.casoId),
]);

export const movimientosJudiciales = pgTable("movimientos_judiciales", {
  id: serial("id").primaryKey(),
  casoId: integer("caso_id").notNull(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  fecha: timestamp("fecha").notNull(),
  tipo: varchar("tipo", { length: 100 }).notNull(), 
  novedad: text("novedad"),
  descripcion: text("descripcion"),
  foja: varchar("foja", { length: 50 }),
  vencimiento: timestamp("vencimiento"),
  sisfeMovId: varchar("sisfe_mov_id", { length: 500 }),
  origenSisfe: boolean("origen_sisfe").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
}, (table) => [
  foreignKey({
    name: "movimientos_judiciales_caso_estudio_fk",
    columns: [table.casoId, table.estudioId],
    foreignColumns: [casos.id, casos.estudioId],
  }).onDelete("cascade"),
  index("movimientos_judiciales_estudio_created_idx").on(table.estudioId, table.createdAt),
  index("movimientos_judiciales_estudio_caso_idx").on(table.estudioId, table.casoId),
  // Dedup de movimientos SISFE acotado al expediente: sisfe_mov_id es un id global del
  // portal, por lo que la unicidad debe ser por (caso_id, sisfe_mov_id) y no global, para
  // no cruzar movimientos entre estudios que sigan el mismo expediente publico. Los NULL
  // (movimientos manuales) son distintos entre si en Postgres, asi que no se ven afectados.
  uniqueIndex("movimientos_judiciales_caso_sisfe_mov_unique").on(table.casoId, table.sisfeMovId),
]);

// Estado "visto/leído" de un movimiento judicial por usuario.
// La ausencia de fila = no leído. Permite que cada integrante del estudio
// tenga su propio control de novedades sobre el mismo expediente.
export const movimientosVistos = pgTable("movimientos_vistos", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  movimientoId: integer("movimiento_id")
    .references(() => movimientosJudiciales.id, { onDelete: "cascade" })
    .notNull(),
  usuarioId: integer("usuario_id").references(() => usuarios.id).notNull(),
  vistoAt: timestamp("visto_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("movimientos_vistos_usuario_mov_unico").on(table.usuarioId, table.movimientoId),
  index("movimientos_vistos_estudio_usuario_idx").on(table.estudioId, table.usuarioId),
]);

export const notasCaso = pgTable("notas_caso", {
  id: serial("id").primaryKey(),
  casoId: integer("caso_id").notNull(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  contenido: text("contenido").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
}, (table) => [
  foreignKey({
    name: "notas_caso_caso_estudio_fk",
    columns: [table.casoId, table.estudioId],
    foreignColumns: [casos.id, casos.estudioId],
  }).onDelete("cascade"),
]);

export const notasCliente = pgTable("notas_cliente", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").notNull(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  contenido: text("contenido").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
}, (table) => [
  foreignKey({
    name: "notas_cliente_cliente_estudio_fk",
    columns: [table.clienteId, table.estudioId],
    foreignColumns: [clientes.id, clientes.estudioId],
  }).onDelete("cascade"),
]);

// ==========================================
// 7. AGENDA Y TAREAS
// ==========================================
export const eventos = pgTable("eventos", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  casoId: integer("caso_id"),
  clienteId: integer("cliente_id"),
  fechaInicio: timestamp("fecha_inicio").notNull(),
  fechaFin: timestamp("fecha_fin"),
  allDay: boolean("all_day").default(false).notNull(),
  tipoId: integer("tipo_id").references(() => parametros.id).notNull(),
  estadoId: integer("estado_id").references(() => parametros.id),
  descripcion: text("descripcion"),
  observaciones: text("observaciones"),
  recordatorio: timestamp("recordatorio"),
  recordatorioEnviado: boolean("recordatorio_enviado").default(false).notNull(),
  ubicacion: varchar("ubicacion", { length: 255 }),
  activo: boolean("activo").default(true).notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  updatedBy: integer("updated_by").references(() => usuarios.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by").references(() => usuarios.id),
}, (table) => [
  foreignKey({
    name: "eventos_caso_estudio_fk",
    columns: [table.casoId, table.estudioId],
    foreignColumns: [casos.id, casos.estudioId],
  }),
  foreignKey({
    name: "eventos_cliente_estudio_fk",
    columns: [table.clienteId, table.estudioId],
    foreignColumns: [clientes.id, clientes.estudioId],
  }),
  index("eventos_estudio_created_idx")
    .on(table.estudioId, table.createdAt)
    .where(sql`${table.deletedAt} IS NULL`),
  index("eventos_estudio_caso_idx")
    .on(table.estudioId, table.casoId)
    .where(sql`${table.deletedAt} IS NULL`),
  index("eventos_estudio_cliente_idx")
    .on(table.estudioId, table.clienteId)
    .where(sql`${table.deletedAt} IS NULL`),
]);

export const tareas = pgTable("tareas", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  fechaLimite: timestamp("fecha_limite"),
  prioridadId: integer("prioridad_id").references(() => parametros.id),
  recordatorio: timestamp("recordatorio"),
  completada: boolean("completada").default(false).notNull(),
  completadaAt: timestamp("completada_at"),
  asignadoA: integer("asignado_a").references(() => usuarios.id),
  clienteId: integer("cliente_id"),
  casoId: integer("caso_id"),
  // Plazo de un movimiento judicial: la tarea ES el plazo (con su fechaLimite + recordatorio),
  // vinculada al movimiento puntual. set null si se borra el movimiento (la tarea sobrevive).
  movimientoId: integer("movimiento_id").references(() => movimientosJudiciales.id, { onDelete: "set null" }),
  recordatorioEnviado: boolean("recordatorio_enviado").default(false).notNull(),
  activo: boolean("activo").default(true).notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  updatedBy: integer("updated_by").references(() => usuarios.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by").references(() => usuarios.id),
}, (table) => [
  foreignKey({
    name: "tareas_cliente_estudio_fk",
    columns: [table.clienteId, table.estudioId],
    foreignColumns: [clientes.id, clientes.estudioId],
  }),
  foreignKey({
    name: "tareas_caso_estudio_fk",
    columns: [table.casoId, table.estudioId],
    foreignColumns: [casos.id, casos.estudioId],
  }),
  index("tareas_estudio_created_idx")
    .on(table.estudioId, table.createdAt)
    .where(sql`${table.deletedAt} IS NULL`),
  index("tareas_estudio_caso_idx")
    .on(table.estudioId, table.casoId)
    .where(sql`${table.deletedAt} IS NULL`),
  index("tareas_estudio_cliente_idx")
    .on(table.estudioId, table.clienteId)
    .where(sql`${table.deletedAt} IS NULL`),
  index("tareas_movimiento_idx")
    .on(table.movimientoId)
    .where(sql`${table.deletedAt} IS NULL`),
]);

export const subTareas = pgTable("sub_tareas", {
  id: serial("id").primaryKey(),
  tareaId: integer("tarea_id").references(() => tareas.id).notNull(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  completada: boolean("completada").default(false).notNull(),
  completadaAt: timestamp("completada_at"),
  orden: integer("orden").default(0).notNull(),
  activo: boolean("activo").default(true).notNull(),
  deletedAt: timestamp("deleted_at"),
});

// ==========================================
// 8. ECONOMÍA (Honorarios, Gastos, Ingresos)
// ==========================================
export const honorarios = pgTable("honorarios", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  clienteId: integer("cliente_id"),
  casoId: integer("caso_id"),
  conceptoId: integer("concepto_id").references(() => parametros.id).notNull(),
  parteId: integer("parte_id").references(() => parametros.id).notNull(),
  jus: decimal("jus", { precision: 14, scale: 4 }),
  montoPesos: decimal("monto_pesos", { precision: 14, scale: 2 }),
  monedaId: integer("moneda_id").references(() => parametros.id),
  valorJusRef: decimal("valor_jus_ref", { precision: 14, scale: 4 }),
  politicaJusId: integer("politica_jus_id").references(() => parametros.id),
  fechaRegulacion: timestamp("fecha_regulacion").notNull(),
  fechaVencimiento: timestamp("fecha_vencimiento"),
  tasaInteresMensual: decimal("tasa_interes_mensual", { precision: 5, scale: 2 }),
  estadoId: integer("estado_id").references(() => parametros.id),
  activo: boolean("activo").default(true).notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  updatedBy: integer("updated_by").references(() => usuarios.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by").references(() => usuarios.id),
}, (table) => [
  foreignKey({
    name: "honorarios_cliente_estudio_fk",
    columns: [table.clienteId, table.estudioId],
    foreignColumns: [clientes.id, clientes.estudioId],
  }),
  foreignKey({
    name: "honorarios_caso_estudio_fk",
    columns: [table.casoId, table.estudioId],
    foreignColumns: [casos.id, casos.estudioId],
  }).onDelete("cascade"),
  index("honorarios_estudio_created_idx")
    .on(table.estudioId, table.createdAt)
    .where(sql`${table.deletedAt} IS NULL`),
  index("honorarios_estudio_cliente_idx")
    .on(table.estudioId, table.clienteId)
    .where(sql`${table.deletedAt} IS NULL`),
  index("honorarios_estudio_caso_idx")
    .on(table.estudioId, table.casoId)
    .where(sql`${table.deletedAt} IS NULL`),
]);

export const gastos = pgTable("gastos", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  clienteId: integer("cliente_id").notNull(),
  casoId: integer("caso_id"),
  conceptoId: integer("concepto_id").references(() => parametros.id),
  descripcion: text("descripcion"),
  fechaGasto: timestamp("fecha_gasto").notNull(),
  monto: decimal("monto", { precision: 14, scale: 2 }).notNull(),
  monedaId: integer("moneda_id").references(() => parametros.id),
  cotizacionArs: decimal("cotizacion_ars", { precision: 14, scale: 4 }),
  estadoId: integer("estado_id").references(() => parametros.id),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
  updatedAt: timestamp("updated_at"),
  updatedBy: integer("updated_by").references(() => usuarios.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by").references(() => usuarios.id),
}, (table) => [
  foreignKey({
    name: "gastos_cliente_estudio_fk",
    columns: [table.clienteId, table.estudioId],
    foreignColumns: [clientes.id, clientes.estudioId],
  }),
  foreignKey({
    name: "gastos_caso_estudio_fk",
    columns: [table.casoId, table.estudioId],
    foreignColumns: [casos.id, casos.estudioId],
  }),
  index("gastos_estudio_created_idx")
    .on(table.estudioId, table.createdAt)
    .where(sql`${table.deletedAt} IS NULL`),
  index("gastos_estudio_cliente_idx")
    .on(table.estudioId, table.clienteId)
    .where(sql`${table.deletedAt} IS NULL`),
  index("gastos_estudio_caso_idx")
    .on(table.estudioId, table.casoId)
    .where(sql`${table.deletedAt} IS NULL`),
]);

export const ingresos = pgTable("ingresos", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  clienteId: integer("cliente_id"),
  casoId: integer("caso_id"),
  cuotaId: integer("cuota_id").references(() => planCuotas.id, { onDelete: "set null" }),
  descripcion: text("descripcion"),
  monto: decimal("monto", { precision: 14, scale: 2 }).notNull(),
  monedaId: integer("moneda_id").references(() => parametros.id),
  cotizacionArs: decimal("cotizacion_ars", { precision: 14, scale: 4 }),
  valorJusAlCobro: decimal("valor_jus_al_cobro", { precision: 14, scale: 4 }),
  fechaIngreso: timestamp("fecha_ingreso").notNull(),
  tipoId: integer("tipo_id").references(() => parametros.id),
  estadoId: integer("estado_id").references(() => parametros.id),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
  updatedAt: timestamp("updated_at"),
  updatedBy: integer("updated_by").references(() => usuarios.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by").references(() => usuarios.id),
}, (table) => [
  foreignKey({
    name: "ingresos_cliente_estudio_fk",
    columns: [table.clienteId, table.estudioId],
    foreignColumns: [clientes.id, clientes.estudioId],
  }),
  foreignKey({
    name: "ingresos_caso_estudio_fk",
    columns: [table.casoId, table.estudioId],
    foreignColumns: [casos.id, casos.estudioId],
  }),
  index("ingresos_estudio_created_idx")
    .on(table.estudioId, table.createdAt)
    .where(sql`${table.deletedAt} IS NULL`),
  index("ingresos_estudio_cliente_idx")
    .on(table.estudioId, table.clienteId)
    .where(sql`${table.deletedAt} IS NULL`),
  index("ingresos_estudio_caso_idx")
    .on(table.estudioId, table.casoId)
    .where(sql`${table.deletedAt} IS NULL`),
]);

export const ingresoAplicaciones = pgTable("ingreso_aplicaciones", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  ingresoId: integer("ingreso_id").references(() => ingresos.id, { onDelete: "cascade" }).notNull(),
  cuotaId: integer("cuota_id").references(() => planCuotas.id, { onDelete: "cascade" }),
  gastoId: integer("gasto_id").references(() => gastos.id, { onDelete: "cascade" }),
  // Cobro aplicado directamente a un honorario sin plan de pago (parcial o total). Un
  // aplicacion apunta a exactamente uno: cuota, gasto u honorario.
  honorarioId: integer("honorario_id").references(() => honorarios.id, { onDelete: "cascade" }),
  monto: decimal("monto", { precision: 14, scale: 2 }).notNull(),
  montoCapital: decimal("monto_capital", { precision: 14, scale: 2 }).default("0").notNull(),
  montoInteres: decimal("monto_interes", { precision: 14, scale: 2 }).default("0").notNull(),
  valorJusAlCobro: decimal("valor_jus_al_cobro", { precision: 14, scale: 4 }),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
  updatedAt: timestamp("updated_at"),
  updatedBy: integer("updated_by").references(() => usuarios.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by").references(() => usuarios.id),
}, (table) => [
  index("ingreso_aplicaciones_estudio_created_idx")
    .on(table.estudioId, table.createdAt)
    .where(sql`${table.deletedAt} IS NULL`),
  index("ingreso_aplicaciones_estudio_ingreso_idx")
    .on(table.estudioId, table.ingresoId)
    .where(sql`${table.deletedAt} IS NULL`),
  index("ingreso_aplicaciones_estudio_cuota_idx")
    .on(table.estudioId, table.cuotaId)
    .where(sql`${table.deletedAt} IS NULL`),
  index("ingreso_aplicaciones_cuota_id_idx").on(table.cuotaId),
  index("ingreso_aplicaciones_estudio_honorario_idx")
    .on(table.estudioId, table.honorarioId)
    .where(sql`${table.deletedAt} IS NULL`),
  check(
    "ingreso_aplicaciones_monto_partes_check",
    sql`${table.monto} = ${table.montoCapital} + ${table.montoInteres}`
  ),
]);

export const planesPago = pgTable("planes_pago", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  honorarioId: integer("honorario_id").references(() => honorarios.id).notNull(),
  clienteId: integer("cliente_id"),
  casoId: integer("caso_id"),
  descripcion: text("descripcion"),
  fechaInicio: timestamp("fecha_inicio"),
  periodicidadId: integer("periodicidad_id").references(() => parametros.id),
  montoCuotaPesos: decimal("monto_cuota_pesos", { precision: 14, scale: 2 }),
  montoCuotaJus: decimal("monto_cuota_jus", { precision: 14, scale: 4 }),
  valorJusRef: decimal("valor_jus_ref", { precision: 14, scale: 4 }),
  politicaJusId: integer("politica_jus_id").references(() => parametros.id),
  monedaId: integer("moneda_id").references(() => parametros.id),
  tasaInteresMensual: decimal("tasa_interes_mensual", { precision: 8, scale: 6 }),
  regimenMora: text("regimen_mora").default("SIMPLE").notNull(),
  diaVencimiento: integer("dia_vencimiento"),
  activo: boolean("activo").default(true).notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  updatedBy: integer("updated_by").references(() => usuarios.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by").references(() => usuarios.id),
}, (table) => [
  foreignKey({
    name: "planes_pago_cliente_estudio_fk",
    columns: [table.clienteId, table.estudioId],
    foreignColumns: [clientes.id, clientes.estudioId],
  }),
  foreignKey({
    name: "planes_pago_caso_estudio_fk",
    columns: [table.casoId, table.estudioId],
    foreignColumns: [casos.id, casos.estudioId],
  }),
  index("planes_pago_estudio_created_idx")
    .on(table.estudioId, table.createdAt)
    .where(sql`${table.deletedAt} IS NULL`),
  index("planes_pago_estudio_cliente_idx")
    .on(table.estudioId, table.clienteId)
    .where(sql`${table.deletedAt} IS NULL`),
  index("planes_pago_estudio_caso_idx")
    .on(table.estudioId, table.casoId)
    .where(sql`${table.deletedAt} IS NULL`),
  check(
    "planes_pago_regimen_mora_check",
    sql`${table.regimenMora} in ('SIMPLE', 'COMPUESTO')`
  ),
]);

export const planCuotas = pgTable("plan_cuotas", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").references(() => planesPago.id).notNull(),
  numero: integer("numero").notNull(),
  vencimiento: timestamp("vencimiento").notNull(),
  montoPesos: decimal("monto_pesos", { precision: 14, scale: 2 }),
  montoJus: decimal("monto_jus", { precision: 14, scale: 4 }),
  valorJusRef: decimal("valor_jus_ref", { precision: 14, scale: 4 }),
  // Espejo materializado de SUM(ingreso_aplicaciones.monto activas) para esta cuota.
  // NO es la fuente de verdad (esa sigue siendo la suma de ingreso_aplicaciones);
  // actua como red de seguridad (defensa en profundidad) junto con el CHECK.
  montoAplicado: decimal("monto_aplicado", { precision: 14, scale: 2 }).default("0").notNull(),
  estadoId: integer("estado_id").references(() => parametros.id),
  activo: boolean("activo").default(true).notNull(),
  createdBy: integer("created_by").references(() => usuarios.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  updatedBy: integer("updated_by").references(() => usuarios.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: integer("deleted_by").references(() => usuarios.id),
}, (table) => [
  uniqueIndex("plan_cuotas_plan_numero_unique").on(table.planId, table.numero),
  index("plan_cuotas_plan_created_idx")
    .on(table.planId, table.createdAt)
    .where(sql`${table.deletedAt} IS NULL`),
  // Guardrail anti sobre-imputacion. Solo aplica a cuotas en PESOS fijos:
  // - Si la cuota es en JUS (monto_jus IS NOT NULL) el techo en pesos es variable
  //   (montoJus * valorJus del momento, ej. politica AL_COBRO), no se puede acotar aqui.
  // - Si monto_pesos es NULL no hay techo fijo que validar.
  // Tolerancia de 0.01 por redondeo de decimales.
  check(
    "plan_cuotas_monto_aplicado_check",
    sql`${table.montoJus} IS NOT NULL OR ${table.montoPesos} IS NULL OR ${table.montoAplicado} <= ${table.montoPesos} + 0.01`
  ),
]);

// ==========================================
// 9. DOCUMENTOS
// ==========================================
export const adjuntos = pgTable("adjuntos", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  scope: varchar("scope", { length: 50 }).notNull(), // CLIENTE o CASO
  scopeId: integer("scope_id").notNull(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  mime: varchar("mime", { length: 100 }).notNull(),
  driveFileId: varchar("storage_key", { length: 255 }).unique().notNull(),
  driveFolderId: varchar("storage_folder_key", { length: 255 }).notNull(),
  storageDriver: varchar("storage_driver", { length: 50 }).default("google-drive").notNull(),
  etag: varchar("etag", { length: 255 }),
  creadoEn: timestamp("creado_en").defaultNow().notNull(),
  eliminadoEn: timestamp("eliminado_en"),
});

export const storageWatches = pgTable("storage_watches", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  storageDriver: varchar("storage_driver", { length: 50 }).default("google-drive").notNull(),
  channelId: varchar("channel_id", { length: 255 }).unique().notNull(),
  resourceId: varchar("resource_id", { length: 255 }),
  pageToken: varchar("page_token", { length: 255 }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const plantillas = pgTable("plantillas", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  contenidoHtml: text("contenido_html").notNull(),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditoriaLogs = pgTable("auditoria_logs", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").references(() => estudios.id).notNull(),
  usuarioId: integer("usuario_id").references(() => usuarios.id),
  entidad: varchar("entidad", { length: 50 }).notNull(),
  // Valores posibles: 'caso', 'cliente', 'tarea', 'evento', 'ingreso', 'gasto', 'honorario'
  entidadId: integer("entidad_id"),
  accion: varchar("accion", { length: 50 }).notNull(),
  // Valores posibles: 'CREATE', 'UPDATE', 'DELETE', 'ESTADO_CHANGED', 'COMPLETADA'
  descripcion: text("descripcion"),
  cambios: json("cambios"),
  ip: varchar("ip", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditoriaLogsRelations = relations(auditoriaLogs, ({ one }) => ({
  estudio: one(estudios, {
    fields: [auditoriaLogs.estudioId],
    references: [estudios.id],
  }),
  usuario: one(usuarios, {
    fields: [auditoriaLogs.usuarioId],
    references: [usuarios.id],
  }),
}));

export const systemErrorLogs = pgTable("system_error_logs", {
  id: serial("id").primaryKey(),
  nivel: varchar("nivel", { length: 20 }).notNull(),
  statusCode: integer("status_code").notNull(),
  errorCode: varchar("error_code", { length: 100 }),
  mensaje: text("mensaje").notNull(),
  metodo: varchar("metodo", { length: 10 }),
  ruta: varchar("ruta", { length: 500 }),
  ip: varchar("ip", { length: 100 }),
  usuarioId: integer("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
  estudioId: integer("estudio_id").references(() => estudios.id, { onDelete: "set null" }),
  stackTrace: text("stack_trace"),
  contexto: json("contexto"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const securityAudit = pgTable("security_audit", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id").default(0).notNull(),
  usuarioId: integer("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
  evento: varchar("evento", { length: 80 }).notNull(),
  metodo: varchar("metodo", { length: 10 }),
  path: varchar("path", { length: 500 }),
  ip: varchar("ip", { length: 100 }),
  userAgent: varchar("user_agent", { length: 500 }),
  statusCode: integer("status_code"),
  targetEstudioId: integer("target_estudio_id"),
  metadata: json("metadata"),
  previousHash: varchar("previous_hash", { length: 64 }),
  rowHash: varchar("row_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("security_audit_estudio_created_idx").on(table.estudioId, table.createdAt),
  index("security_audit_usuario_evento_idx").on(table.usuarioId, table.evento),
]);
