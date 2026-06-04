CREATE TABLE "adjuntos" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"scope" varchar(50) NOT NULL,
	"scope_id" integer NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"mime" varchar(100) NOT NULL,
	"drive_file_id" varchar(255) NOT NULL,
	"drive_folder_id" varchar(255) NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "adjuntos_drive_file_id_unique" UNIQUE("drive_file_id")
);
--> statement-breakpoint
CREATE TABLE "casos" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"cliente_id" integer NOT NULL,
	"nro_expte" varchar(100),
	"nro_expte_norm" varchar(100),
	"caratula" varchar(500),
	"tipo_id" integer NOT NULL,
	"descripcion" text,
	"estado_id" integer,
	"fecha_estado" timestamp DEFAULT now() NOT NULL,
	"radicacion_id" integer,
	"estado_radicacion_id" integer,
	"fecha_estado_radicacion" timestamp,
	"drive_folder_id" varchar(255),
	"numero_drive" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
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
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "codigos_postales" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"localidad_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estudios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(255) NOT NULL,
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
	"deleted_at" timestamp
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
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "ingresos" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"cliente_id" integer,
	"caso_id" integer,
	"descripcion" text,
	"monto" numeric(14, 2) NOT NULL,
	"moneda_id" integer,
	"cotizacion_ars" numeric(14, 4),
	"fecha_ingreso" timestamp NOT NULL,
	"tipo_id" integer,
	"estado_id" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"descripcion" text,
	"foja" varchar(50),
	"vencimiento" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
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
	"caso_id" integer NOT NULL,
	"tercero_id" integer NOT NULL,
	"rol_id" integer,
	"observaciones" text
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
	"estado_id" integer,
	"activo" boolean DEFAULT true NOT NULL
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
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"token_hash" varchar(500) NOT NULL,
	"user_agent" varchar(255),
	"ip" varchar(50),
	"expires_at" timestamp NOT NULL,
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
	"recordatorio_enviado" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
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
	"created_at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "casos" ADD CONSTRAINT "casos_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_tipo_id_parametros_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_estado_id_parametros_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_radicacion_id_parametros_id_fk" FOREIGN KEY ("radicacion_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_estado_radicacion_id_parametros_id_fk" FOREIGN KEY ("estado_radicacion_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tipo_persona_id_parametros_id_fk" FOREIGN KEY ("tipo_persona_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_provincia_id_provincias_id_fk" FOREIGN KEY ("provincia_id") REFERENCES "public"."provincias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_localidad_id_localidades_id_fk" FOREIGN KEY ("localidad_id") REFERENCES "public"."localidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codigos_postales" ADD CONSTRAINT "codigos_postales_localidad_id_localidades_id_fk" FOREIGN KEY ("localidad_id") REFERENCES "public"."localidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estudios" ADD CONSTRAINT "estudios_provincia_id_provincias_id_fk" FOREIGN KEY ("provincia_id") REFERENCES "public"."provincias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estudios" ADD CONSTRAINT "estudios_localidad_id_localidades_id_fk" FOREIGN KEY ("localidad_id") REFERENCES "public"."localidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_caso_id_casos_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_tipo_id_parametros_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_estado_id_parametros_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_caso_id_casos_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_concepto_id_parametros_id_fk" FOREIGN KEY ("concepto_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_moneda_id_parametros_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_caso_id_casos_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_concepto_id_parametros_id_fk" FOREIGN KEY ("concepto_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_parte_id_parametros_id_fk" FOREIGN KEY ("parte_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_moneda_id_parametros_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_politica_jus_id_parametros_id_fk" FOREIGN KEY ("politica_jus_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_estado_id_parametros_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_caso_id_casos_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_moneda_id_parametros_id_fk" FOREIGN KEY ("moneda_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_tipo_id_parametros_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_estado_id_parametros_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "localidades" ADD CONSTRAINT "localidades_provincia_id_provincias_id_fk" FOREIGN KEY ("provincia_id") REFERENCES "public"."provincias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" ADD CONSTRAINT "movimientos_judiciales_caso_id_casos_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" ADD CONSTRAINT "movimientos_judiciales_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" ADD CONSTRAINT "movimientos_judiciales_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_caso" ADD CONSTRAINT "notas_caso_caso_id_casos_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_caso" ADD CONSTRAINT "notas_caso_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_caso" ADD CONSTRAINT "notas_caso_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_cliente" ADD CONSTRAINT "notas_cliente_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_cliente" ADD CONSTRAINT "notas_cliente_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_cliente" ADD CONSTRAINT "notas_cliente_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parametros" ADD CONSTRAINT "parametros_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participantes_caso" ADD CONSTRAINT "participantes_caso_caso_id_casos_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participantes_caso" ADD CONSTRAINT "participantes_caso_tercero_id_terceros_id_fk" FOREIGN KEY ("tercero_id") REFERENCES "public"."terceros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participantes_caso" ADD CONSTRAINT "participantes_caso_rol_id_parametros_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permisos" ADD CONSTRAINT "permisos_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD CONSTRAINT "plan_cuotas_plan_id_planes_pago_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes_pago"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD CONSTRAINT "plan_cuotas_estado_id_parametros_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_honorario_id_honorarios_id_fk" FOREIGN KEY ("honorario_id") REFERENCES "public"."honorarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_caso_id_casos_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_periodicidad_id_parametros_id_fk" FOREIGN KEY ("periodicidad_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantillas" ADD CONSTRAINT "plantillas_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provincias" ADD CONSTRAINT "provincias_pais_id_paises_id_fk" FOREIGN KEY ("pais_id") REFERENCES "public"."paises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_tareas" ADD CONSTRAINT "sub_tareas_tarea_id_tareas_id_fk" FOREIGN KEY ("tarea_id") REFERENCES "public"."tareas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_prioridad_id_parametros_id_fk" FOREIGN KEY ("prioridad_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_asignado_a_usuarios_id_fk" FOREIGN KEY ("asignado_a") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_caso_id_casos_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_tipo_persona_id_parametros_id_fk" FOREIGN KEY ("tipo_persona_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_provincia_id_provincias_id_fk" FOREIGN KEY ("provincia_id") REFERENCES "public"."provincias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_localidad_id_localidades_id_fk" FOREIGN KEY ("localidad_id") REFERENCES "public"."localidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_roles" ADD CONSTRAINT "usuario_roles_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_roles" ADD CONSTRAINT "usuario_roles_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valores_jus" ADD CONSTRAINT "valores_jus_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valores_jus" ADD CONSTRAINT "valores_jus_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "valores_jus_estudio_fecha_unique" ON "valores_jus" USING btree ("estudio_id","fecha");