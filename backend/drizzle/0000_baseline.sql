CREATE TABLE "adjuntos" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"scope" varchar(50) NOT NULL,
	"scope_id" integer NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"mime" varchar(100) NOT NULL,
	"storage_key" varchar(255) NOT NULL,
	"storage_folder_key" varchar(255) NOT NULL,
	"storage_driver" varchar(50) DEFAULT 'google-drive' NOT NULL,
	"etag" varchar(255),
	"creado_en" timestamp DEFAULT now() NOT NULL,
	"eliminado_en" timestamp,
	CONSTRAINT "adjuntos_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "auditoria_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"usuario_id" integer,
	"entidad" varchar(50) NOT NULL,
	"entidad_id" integer,
	"accion" varchar(50) NOT NULL,
	"descripcion" text,
	"cambios" json,
	"ip" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caso_trazabilidad" (
	"id" serial PRIMARY KEY NOT NULL,
	"caso_id" integer NOT NULL,
	"estudio_id" integer NOT NULL,
	"ubicacion" varchar(500) NOT NULL,
	"fecha_desde" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "casos" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"cliente_id" integer NOT NULL,
	"nro_expte" varchar(100),
	"nro_expte_norm" varchar(100),
	"sisfe_expte_id" varchar(50),
	"sisfe_last_sync_at" timestamp,
	"sisfe_synced_by" integer,
	"sisfe_radicado_en" varchar(500),
	"sisfe_localidad" varchar(255),
	"sisfe_fecha_ingreso_meu" timestamp,
	"sisfe_ubicacion_actual" varchar(500),
	"sisfe_fecha_ubicacion_actual" timestamp,
	"sisfe_solo_digital" boolean,
	"sisfe_fecha_ultima_actualizacion" timestamp,
	"sisfe_expediente_digital_at" timestamp,
	"caratula" varchar(500),
	"tipo_id" integer NOT NULL,
	"descripcion" text,
	"estado_id" integer,
	"fecha_estado" timestamp DEFAULT now() NOT NULL,
	"radicacion_id" integer,
	"estado_radicacion_id" integer,
	"fecha_estado_radicacion" timestamp,
	"responsable_id" integer,
	"drive_folder_id" varchar(255),
	"numero_drive" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp,
	"updated_by" integer,
	"deleted_at" timestamp,
	"deleted_by" integer,
	CONSTRAINT "casos_id_estudio_id_unique" UNIQUE("id","estudio_id")
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categorias_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"tipo_persona_id" integer NOT NULL,
	"nombre" varchar(100),
	"apellido" varchar(100),
	"razon_social" varchar(255),
	"dni" varchar(50),
	"cuit" varchar(50),
	"fecha_nacimiento" timestamp,
	"email" varchar(255),
	"tel_fijo" varchar(50),
	"tel_celular" varchar(50),
	"dir_calle" varchar(255),
	"dir_nro" varchar(50),
	"dir_piso" varchar(50),
	"dir_depto" varchar(50),
	"codigo_postal" varchar(20),
	"provincia_id" integer,
	"localidad_id" integer,
	"observaciones" text,
	"activo" boolean DEFAULT true NOT NULL,
	"drive_folder_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp,
	"updated_by" integer,
	"deleted_at" timestamp,
	"deleted_by" integer,
	CONSTRAINT "clientes_id_estudio_id_unique" UNIQUE("id","estudio_id")
);
--> statement-breakpoint
CREATE TABLE "codigos_postales" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"localidad_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contactos_clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" integer NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"rol" varchar(100),
	"email" varchar(255),
	"telefono" varchar(50),
	"observaciones" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp,
	"updated_by" integer,
	"deleted_at" timestamp,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE "estudios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"plan_suscripcion_id" integer,
	"plan" varchar(50) DEFAULT 'SOLO' NOT NULL,
	"max_usuarios" integer DEFAULT 1 NOT NULL,
	"almacenamiento_gb" integer DEFAULT 5 NOT NULL,
	"cuit" varchar(50),
	"dir_calle" varchar(255),
	"dir_nro" varchar(50),
	"dir_piso" varchar(50),
	"dir_depto" varchar(50),
	"codigo_postal" varchar(20),
	"provincia_id" integer,
	"localidad_id" integer,
	"telefono" varchar(50),
	"email_contacto" varchar(255),
	"logo_url" varchar(500),
	"drive_folder_id" varchar(255),
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventos" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"caso_id" integer,
	"cliente_id" integer,
	"fecha_inicio" timestamp NOT NULL,
	"fecha_fin" timestamp,
	"all_day" boolean DEFAULT false NOT NULL,
	"tipo_id" integer NOT NULL,
	"estado_id" integer,
	"descripcion" text,
	"observaciones" text,
	"recordatorio" timestamp,
	"recordatorio_enviado" boolean DEFAULT false NOT NULL,
	"ubicacion" varchar(255),
	"activo" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"updated_by" integer,
	"deleted_at" timestamp,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE "gastos" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"cliente_id" integer NOT NULL,
	"caso_id" integer,
	"concepto_id" integer,
	"descripcion" text,
	"fecha_gasto" timestamp NOT NULL,
	"monto" numeric(14, 2) NOT NULL,
	"moneda_id" integer,
	"cotizacion_ars" numeric(14, 4),
	"estado_id" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp,
	"updated_by" integer,
	"deleted_at" timestamp,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE "honorarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"cliente_id" integer,
	"caso_id" integer,
	"concepto_id" integer NOT NULL,
	"parte_id" integer NOT NULL,
	"jus" numeric(14, 4),
	"monto_pesos" numeric(14, 2),
	"moneda_id" integer,
	"valor_jus_ref" numeric(14, 4),
	"politica_jus_id" integer,
	"fecha_regulacion" timestamp NOT NULL,
	"fecha_vencimiento" timestamp,
	"tasa_interes_mensual" numeric(5, 2),
	"estado_id" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"updated_by" integer,
	"deleted_at" timestamp,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE "ingreso_aplicaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"ingreso_id" integer NOT NULL,
	"cuota_id" integer,
	"gasto_id" integer,
	"honorario_id" integer,
	"monto" numeric(14, 2) NOT NULL,
	"monto_capital" numeric(14, 2) DEFAULT '0' NOT NULL,
	"monto_interes" numeric(14, 2) DEFAULT '0' NOT NULL,
	"valor_jus_al_cobro" numeric(14, 4),
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp,
	"updated_by" integer,
	"deleted_at" timestamp,
	"deleted_by" integer,
	CONSTRAINT "ingreso_aplicaciones_monto_partes_check" CHECK ("ingreso_aplicaciones"."monto" = "ingreso_aplicaciones"."monto_capital" + "ingreso_aplicaciones"."monto_interes")
);
--> statement-breakpoint
CREATE TABLE "ingresos" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"cliente_id" integer,
	"caso_id" integer,
	"cuota_id" integer,
	"descripcion" text,
	"monto" numeric(14, 2) NOT NULL,
	"moneda_id" integer,
	"cotizacion_ars" numeric(14, 4),
	"valor_jus_al_cobro" numeric(14, 4),
	"fecha_ingreso" timestamp NOT NULL,
	"tipo_id" integer,
	"estado_id" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp,
	"updated_by" integer,
	"deleted_at" timestamp,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE "localidades" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"provincia_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos_judiciales" (
	"id" serial PRIMARY KEY NOT NULL,
	"caso_id" integer NOT NULL,
	"estudio_id" integer NOT NULL,
	"fecha" timestamp NOT NULL,
	"tipo" varchar(100) NOT NULL,
	"novedad" text,
	"descripcion" text,
	"foja" varchar(50),
	"vencimiento" timestamp,
	"sisfe_mov_id" varchar(500),
	"origen_sisfe" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "movimientos_vistos" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"movimiento_id" integer NOT NULL,
	"usuario_id" integer NOT NULL,
	"visto_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notas_caso" (
	"id" serial PRIMARY KEY NOT NULL,
	"caso_id" integer NOT NULL,
	"estudio_id" integer NOT NULL,
	"contenido" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "notas_cliente" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" integer NOT NULL,
	"estudio_id" integer NOT NULL,
	"contenido" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "paises" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"codigo_iso" varchar(10)
);
--> statement-breakpoint
CREATE TABLE "parametros" (
	"id" serial PRIMARY KEY NOT NULL,
	"categoria_id" integer NOT NULL,
	"parent_id" integer,
	"codigo" varchar(50) NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"extra" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participantes_caso" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"caso_id" integer NOT NULL,
	"tercero_id" integer NOT NULL,
	"rol_id" integer,
	"observaciones" text
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"token_hash" varchar(500) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permisos" (
	"id" serial PRIMARY KEY NOT NULL,
	"rol_id" integer NOT NULL,
	"modulo" varchar(100) NOT NULL,
	"ver" boolean DEFAULT false NOT NULL,
	"crear" boolean DEFAULT false NOT NULL,
	"editar" boolean DEFAULT false NOT NULL,
	"eliminar" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_cuotas" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"vencimiento" timestamp NOT NULL,
	"monto_pesos" numeric(14, 2),
	"monto_jus" numeric(14, 4),
	"valor_jus_ref" numeric(14, 4),
	"monto_aplicado" numeric(14, 2) DEFAULT '0' NOT NULL,
	"estado_id" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"updated_by" integer,
	"deleted_at" timestamp,
	"deleted_by" integer,
	CONSTRAINT "plan_cuotas_monto_aplicado_check" CHECK ("plan_cuotas"."monto_jus" IS NOT NULL OR "plan_cuotas"."monto_pesos" IS NULL OR "plan_cuotas"."monto_aplicado" <= "plan_cuotas"."monto_pesos" + 0.01)
);
--> statement-breakpoint
CREATE TABLE "planes_pago" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"honorario_id" integer NOT NULL,
	"cliente_id" integer,
	"caso_id" integer,
	"descripcion" text,
	"fecha_inicio" timestamp,
	"periodicidad_id" integer,
	"monto_cuota_pesos" numeric(14, 2),
	"monto_cuota_jus" numeric(14, 4),
	"valor_jus_ref" numeric(14, 4),
	"politica_jus_id" integer,
	"moneda_id" integer,
	"tasa_interes_mensual" numeric(8, 6),
	"regimen_mora" text DEFAULT 'SIMPLE' NOT NULL,
	"dia_vencimiento" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"updated_by" integer,
	"deleted_at" timestamp,
	"deleted_by" integer,
	CONSTRAINT "planes_pago_regimen_mora_check" CHECK ("planes_pago"."regimen_mora" in ('SIMPLE', 'COMPUESTO'))
);
--> statement-breakpoint
CREATE TABLE "planes_suscripcion" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"max_usuarios" integer NOT NULL,
	"almacenamiento_gb" integer NOT NULL,
	"precio_mensual_ars" numeric(14, 2) NOT NULL,
	"precio_mensual_jus" numeric(14, 4) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "planes_suscripcion_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "plantillas" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"contenido_html" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provincias" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"pais_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"usuario_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"jti_hash" varchar(64),
	"family_id" uuid,
	"user_agent" varchar(255),
	"ip" varchar(50),
	"expires_at" timestamp NOT NULL,
	"rotated_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "roles_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "security_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer DEFAULT 0 NOT NULL,
	"usuario_id" integer,
	"evento" varchar(80) NOT NULL,
	"metodo" varchar(10),
	"path" varchar(500),
	"ip" varchar(100),
	"user_agent" varchar(500),
	"status_code" integer,
	"target_estudio_id" integer,
	"metadata" json,
	"previous_hash" varchar(64),
	"row_hash" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sisfe_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"estudio_id" integer NOT NULL,
	"session_cookie_encriptada" text NOT NULL,
	"cookie_name" varchar(100) NOT NULL,
	"sisfe_matricula" varchar(50),
	"last_verified_at" timestamp,
	"last_sync_at" timestamp,
	"sync_status" varchar(20) DEFAULT 'idle' NOT NULL,
	"sync_progress" integer DEFAULT 0 NOT NULL,
	"sync_message" text,
	"sync_stats" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_watches" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"storage_driver" varchar(50) DEFAULT 'google-drive' NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"resource_id" varchar(255),
	"page_token" varchar(255),
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "storage_watches_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
CREATE TABLE "sub_tareas" (
	"id" serial PRIMARY KEY NOT NULL,
	"tarea_id" integer NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"descripcion" text,
	"completada" boolean DEFAULT false NOT NULL,
	"completada_at" timestamp,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "system_error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"nivel" varchar(20) NOT NULL,
	"status_code" integer NOT NULL,
	"error_code" varchar(100),
	"mensaje" text NOT NULL,
	"metodo" varchar(10),
	"ruta" varchar(500),
	"ip" varchar(100),
	"usuario_id" integer,
	"estudio_id" integer,
	"stack_trace" text,
	"contexto" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tareas" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"descripcion" text,
	"fecha_limite" timestamp,
	"prioridad_id" integer,
	"recordatorio" timestamp,
	"completada" boolean DEFAULT false NOT NULL,
	"completada_at" timestamp,
	"asignado_a" integer,
	"cliente_id" integer,
	"caso_id" integer,
	"movimiento_id" integer,
	"recordatorio_enviado" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"updated_by" integer,
	"deleted_at" timestamp,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE "terceros" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"tipo_persona_id" integer NOT NULL,
	"nombre" varchar(100),
	"apellido" varchar(100),
	"razon_social" varchar(255),
	"dni" varchar(50),
	"cuit" varchar(50),
	"fecha_nacimiento" timestamp,
	"email" varchar(255),
	"telefono" varchar(50),
	"dir_calle" varchar(255),
	"dir_nro" varchar(50),
	"dir_piso" varchar(50),
	"dir_depto" varchar(50),
	"codigo_postal" varchar(20),
	"provincia_id" integer,
	"localidad_id" integer,
	"observaciones" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp,
	"updated_by" integer,
	"deleted_at" timestamp,
	"deleted_by" integer,
	CONSTRAINT "terceros_id_estudio_id_unique" UNIQUE("id","estudio_id")
);
--> statement-breakpoint
CREATE TABLE "usuario_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"rol_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"apellido" varchar(100) NOT NULL,
	"dni" varchar(50),
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"telefono" varchar(50),
	"activo" boolean DEFAULT true NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp,
	"must_change_pass" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "valores_jus" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"valor" numeric(14, 4) NOT NULL,
	"fecha" timestamp NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria_logs" ADD CONSTRAINT "auditoria_logs_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria_logs" ADD CONSTRAINT "auditoria_logs_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caso_trazabilidad" ADD CONSTRAINT "caso_trazabilidad_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caso_trazabilidad" ADD CONSTRAINT "caso_trazabilidad_caso_estudio_fk" FOREIGN KEY ("caso_id","estudio_id") REFERENCES "public"."casos"("id","estudio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_sisfe_synced_by_usuarios_id_fk" FOREIGN KEY ("sisfe_synced_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_tipo_id_parametros_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_estado_id_parametros_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_radicacion_id_parametros_id_fk" FOREIGN KEY ("radicacion_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_estado_radicacion_id_parametros_id_fk" FOREIGN KEY ("estado_radicacion_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_cliente_estudio_fk" FOREIGN KEY ("cliente_id","estudio_id") REFERENCES "public"."clientes"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tipo_persona_id_parametros_id_fk" FOREIGN KEY ("tipo_persona_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_provincia_id_provincias_id_fk" FOREIGN KEY ("provincia_id") REFERENCES "public"."provincias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_localidad_id_localidades_id_fk" FOREIGN KEY ("localidad_id") REFERENCES "public"."localidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codigos_postales" ADD CONSTRAINT "codigos_postales_localidad_id_localidades_id_fk" FOREIGN KEY ("localidad_id") REFERENCES "public"."localidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ADD CONSTRAINT "contactos_clientes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ADD CONSTRAINT "contactos_clientes_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ADD CONSTRAINT "contactos_clientes_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ADD CONSTRAINT "contactos_clientes_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estudios" ADD CONSTRAINT "estudios_plan_suscripcion_id_planes_suscripcion_id_fk" FOREIGN KEY ("plan_suscripcion_id") REFERENCES "public"."planes_suscripcion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estudios" ADD CONSTRAINT "estudios_provincia_id_provincias_id_fk" FOREIGN KEY ("provincia_id") REFERENCES "public"."provincias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estudios" ADD CONSTRAINT "estudios_localidad_id_localidades_id_fk" FOREIGN KEY ("localidad_id") REFERENCES "public"."localidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_tipo_id_parametros_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_estado_id_parametros_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_caso_estudio_fk" FOREIGN KEY ("caso_id","estudio_id") REFERENCES "public"."casos"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_cliente_estudio_fk" FOREIGN KEY ("cliente_id","estudio_id") REFERENCES "public"."clientes"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_concepto_id_parametros_id_fk" FOREIGN KEY ("concepto_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_moneda_id_parametros_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_estado_id_parametros_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_cliente_estudio_fk" FOREIGN KEY ("cliente_id","estudio_id") REFERENCES "public"."clientes"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_caso_estudio_fk" FOREIGN KEY ("caso_id","estudio_id") REFERENCES "public"."casos"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_concepto_id_parametros_id_fk" FOREIGN KEY ("concepto_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_parte_id_parametros_id_fk" FOREIGN KEY ("parte_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_moneda_id_parametros_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_politica_jus_id_parametros_id_fk" FOREIGN KEY ("politica_jus_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_estado_id_parametros_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_cliente_estudio_fk" FOREIGN KEY ("cliente_id","estudio_id") REFERENCES "public"."clientes"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_caso_estudio_fk" FOREIGN KEY ("caso_id","estudio_id") REFERENCES "public"."casos"("id","estudio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_ingreso_id_ingresos_id_fk" FOREIGN KEY ("ingreso_id") REFERENCES "public"."ingresos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_cuota_id_plan_cuotas_id_fk" FOREIGN KEY ("cuota_id") REFERENCES "public"."plan_cuotas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_gasto_id_gastos_id_fk" FOREIGN KEY ("gasto_id") REFERENCES "public"."gastos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_honorario_id_honorarios_id_fk" FOREIGN KEY ("honorario_id") REFERENCES "public"."honorarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_cuota_id_plan_cuotas_id_fk" FOREIGN KEY ("cuota_id") REFERENCES "public"."plan_cuotas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_moneda_id_parametros_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_tipo_id_parametros_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_estado_id_parametros_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_cliente_estudio_fk" FOREIGN KEY ("cliente_id","estudio_id") REFERENCES "public"."clientes"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_caso_estudio_fk" FOREIGN KEY ("caso_id","estudio_id") REFERENCES "public"."casos"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "localidades" ADD CONSTRAINT "localidades_provincia_id_provincias_id_fk" FOREIGN KEY ("provincia_id") REFERENCES "public"."provincias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" ADD CONSTRAINT "movimientos_judiciales_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" ADD CONSTRAINT "movimientos_judiciales_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" ADD CONSTRAINT "movimientos_judiciales_caso_estudio_fk" FOREIGN KEY ("caso_id","estudio_id") REFERENCES "public"."casos"("id","estudio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_vistos" ADD CONSTRAINT "movimientos_vistos_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_vistos" ADD CONSTRAINT "movimientos_vistos_movimiento_id_movimientos_judiciales_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos_judiciales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_vistos" ADD CONSTRAINT "movimientos_vistos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_caso" ADD CONSTRAINT "notas_caso_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_caso" ADD CONSTRAINT "notas_caso_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_caso" ADD CONSTRAINT "notas_caso_caso_estudio_fk" FOREIGN KEY ("caso_id","estudio_id") REFERENCES "public"."casos"("id","estudio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_cliente" ADD CONSTRAINT "notas_cliente_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_cliente" ADD CONSTRAINT "notas_cliente_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_cliente" ADD CONSTRAINT "notas_cliente_cliente_estudio_fk" FOREIGN KEY ("cliente_id","estudio_id") REFERENCES "public"."clientes"("id","estudio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parametros" ADD CONSTRAINT "parametros_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participantes_caso" ADD CONSTRAINT "participantes_caso_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participantes_caso" ADD CONSTRAINT "participantes_caso_rol_id_parametros_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participantes_caso" ADD CONSTRAINT "participantes_caso_caso_estudio_fk" FOREIGN KEY ("caso_id","estudio_id") REFERENCES "public"."casos"("id","estudio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participantes_caso" ADD CONSTRAINT "participantes_caso_tercero_estudio_fk" FOREIGN KEY ("tercero_id","estudio_id") REFERENCES "public"."terceros"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permisos" ADD CONSTRAINT "permisos_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD CONSTRAINT "plan_cuotas_plan_id_planes_pago_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes_pago"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD CONSTRAINT "plan_cuotas_estado_id_parametros_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD CONSTRAINT "plan_cuotas_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD CONSTRAINT "plan_cuotas_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD CONSTRAINT "plan_cuotas_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_honorario_id_honorarios_id_fk" FOREIGN KEY ("honorario_id") REFERENCES "public"."honorarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_periodicidad_id_parametros_id_fk" FOREIGN KEY ("periodicidad_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_politica_jus_id_parametros_id_fk" FOREIGN KEY ("politica_jus_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_moneda_id_parametros_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_cliente_estudio_fk" FOREIGN KEY ("cliente_id","estudio_id") REFERENCES "public"."clientes"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_caso_estudio_fk" FOREIGN KEY ("caso_id","estudio_id") REFERENCES "public"."casos"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantillas" ADD CONSTRAINT "plantillas_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provincias" ADD CONSTRAINT "provincias_pais_id_paises_id_fk" FOREIGN KEY ("pais_id") REFERENCES "public"."paises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit" ADD CONSTRAINT "security_audit_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sisfe_sessions" ADD CONSTRAINT "sisfe_sessions_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sisfe_sessions" ADD CONSTRAINT "sisfe_sessions_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_watches" ADD CONSTRAINT "storage_watches_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_tareas" ADD CONSTRAINT "sub_tareas_tarea_id_tareas_id_fk" FOREIGN KEY ("tarea_id") REFERENCES "public"."tareas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_error_logs" ADD CONSTRAINT "system_error_logs_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_error_logs" ADD CONSTRAINT "system_error_logs_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_prioridad_id_parametros_id_fk" FOREIGN KEY ("prioridad_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_asignado_a_usuarios_id_fk" FOREIGN KEY ("asignado_a") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_movimiento_id_movimientos_judiciales_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos_judiciales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_cliente_estudio_fk" FOREIGN KEY ("cliente_id","estudio_id") REFERENCES "public"."clientes"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_caso_estudio_fk" FOREIGN KEY ("caso_id","estudio_id") REFERENCES "public"."casos"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_tipo_persona_id_parametros_id_fk" FOREIGN KEY ("tipo_persona_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_provincia_id_provincias_id_fk" FOREIGN KEY ("provincia_id") REFERENCES "public"."provincias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_localidad_id_localidades_id_fk" FOREIGN KEY ("localidad_id") REFERENCES "public"."localidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_roles" ADD CONSTRAINT "usuario_roles_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_roles" ADD CONSTRAINT "usuario_roles_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valores_jus" ADD CONSTRAINT "valores_jus_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valores_jus" ADD CONSTRAINT "valores_jus_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "casos_estudio_created_idx" ON "casos" USING btree ("estudio_id","created_at") WHERE "casos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "casos_estudio_cliente_idx" ON "casos" USING btree ("estudio_id","cliente_id") WHERE "casos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "casos_cliente_id_idx" ON "casos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "casos_responsable_id_idx" ON "casos" USING btree ("responsable_id");--> statement-breakpoint
CREATE INDEX "clientes_estudio_created_idx" ON "clientes" USING btree ("estudio_id","created_at") WHERE "clientes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "eventos_estudio_created_idx" ON "eventos" USING btree ("estudio_id","created_at") WHERE "eventos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "eventos_estudio_caso_idx" ON "eventos" USING btree ("estudio_id","caso_id") WHERE "eventos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "eventos_estudio_cliente_idx" ON "eventos" USING btree ("estudio_id","cliente_id") WHERE "eventos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "gastos_estudio_created_idx" ON "gastos" USING btree ("estudio_id","created_at") WHERE "gastos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "gastos_estudio_cliente_idx" ON "gastos" USING btree ("estudio_id","cliente_id") WHERE "gastos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "gastos_estudio_caso_idx" ON "gastos" USING btree ("estudio_id","caso_id") WHERE "gastos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "honorarios_estudio_created_idx" ON "honorarios" USING btree ("estudio_id","created_at") WHERE "honorarios"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "honorarios_estudio_cliente_idx" ON "honorarios" USING btree ("estudio_id","cliente_id") WHERE "honorarios"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "honorarios_estudio_caso_idx" ON "honorarios" USING btree ("estudio_id","caso_id") WHERE "honorarios"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ingreso_aplicaciones_estudio_created_idx" ON "ingreso_aplicaciones" USING btree ("estudio_id","created_at") WHERE "ingreso_aplicaciones"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ingreso_aplicaciones_estudio_ingreso_idx" ON "ingreso_aplicaciones" USING btree ("estudio_id","ingreso_id") WHERE "ingreso_aplicaciones"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ingreso_aplicaciones_estudio_cuota_idx" ON "ingreso_aplicaciones" USING btree ("estudio_id","cuota_id") WHERE "ingreso_aplicaciones"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ingreso_aplicaciones_cuota_id_idx" ON "ingreso_aplicaciones" USING btree ("cuota_id");--> statement-breakpoint
CREATE INDEX "ingreso_aplicaciones_estudio_honorario_idx" ON "ingreso_aplicaciones" USING btree ("estudio_id","honorario_id") WHERE "ingreso_aplicaciones"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ingresos_estudio_created_idx" ON "ingresos" USING btree ("estudio_id","created_at") WHERE "ingresos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ingresos_estudio_cliente_idx" ON "ingresos" USING btree ("estudio_id","cliente_id") WHERE "ingresos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ingresos_estudio_caso_idx" ON "ingresos" USING btree ("estudio_id","caso_id") WHERE "ingresos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "movimientos_judiciales_estudio_created_idx" ON "movimientos_judiciales" USING btree ("estudio_id","created_at");--> statement-breakpoint
CREATE INDEX "movimientos_judiciales_estudio_caso_idx" ON "movimientos_judiciales" USING btree ("estudio_id","caso_id");--> statement-breakpoint
CREATE UNIQUE INDEX "movimientos_judiciales_caso_sisfe_mov_unique" ON "movimientos_judiciales" USING btree ("caso_id","sisfe_mov_id");--> statement-breakpoint
CREATE UNIQUE INDEX "movimientos_vistos_usuario_mov_unico" ON "movimientos_vistos" USING btree ("usuario_id","movimiento_id");--> statement-breakpoint
CREATE INDEX "movimientos_vistos_estudio_usuario_idx" ON "movimientos_vistos" USING btree ("estudio_id","usuario_id");--> statement-breakpoint
CREATE INDEX "participantes_caso_estudio_caso_idx" ON "participantes_caso" USING btree ("estudio_id","caso_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_cuotas_plan_numero_unique" ON "plan_cuotas" USING btree ("plan_id","numero");--> statement-breakpoint
CREATE INDEX "plan_cuotas_plan_created_idx" ON "plan_cuotas" USING btree ("plan_id","created_at") WHERE "plan_cuotas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "planes_pago_estudio_created_idx" ON "planes_pago" USING btree ("estudio_id","created_at") WHERE "planes_pago"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "planes_pago_estudio_cliente_idx" ON "planes_pago" USING btree ("estudio_id","cliente_id") WHERE "planes_pago"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "planes_pago_estudio_caso_idx" ON "planes_pago" USING btree ("estudio_id","caso_id") WHERE "planes_pago"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_unico" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_usuario_idx" ON "push_subscriptions" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_jti_hash_unique" ON "refresh_tokens" USING btree ("jti_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "security_audit_estudio_created_idx" ON "security_audit" USING btree ("estudio_id","created_at");--> statement-breakpoint
CREATE INDEX "security_audit_usuario_evento_idx" ON "security_audit" USING btree ("usuario_id","evento");--> statement-breakpoint
CREATE UNIQUE INDEX "sisfe_sessions_usuario_unique" ON "sisfe_sessions" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "tareas_estudio_created_idx" ON "tareas" USING btree ("estudio_id","created_at") WHERE "tareas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tareas_estudio_caso_idx" ON "tareas" USING btree ("estudio_id","caso_id") WHERE "tareas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tareas_estudio_cliente_idx" ON "tareas" USING btree ("estudio_id","cliente_id") WHERE "tareas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tareas_movimiento_idx" ON "tareas" USING btree ("movimiento_id") WHERE "tareas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "valores_jus_estudio_fecha_unique" ON "valores_jus" USING btree ("estudio_id","fecha");