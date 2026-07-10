ALTER TABLE "adjuntos" ALTER COLUMN "creado_en" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "adjuntos" ALTER COLUMN "creado_en" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "adjuntos" ALTER COLUMN "eliminado_en" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auditoria_logs" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auditoria_logs" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "caso_trazabilidad" ALTER COLUMN "fecha_desde" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "caso_trazabilidad" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "caso_trazabilidad" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "casos" ALTER COLUMN "sisfe_last_sync_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "casos" ALTER COLUMN "sisfe_fecha_ingreso_meu" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "casos" ALTER COLUMN "sisfe_fecha_ubicacion_actual" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "casos" ALTER COLUMN "sisfe_fecha_ultima_actualizacion" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "casos" ALTER COLUMN "sisfe_expediente_digital_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "casos" ALTER COLUMN "fecha_estado" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "casos" ALTER COLUMN "fecha_estado" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "casos" ALTER COLUMN "fecha_estado_radicacion" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "casos" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "casos" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "casos" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "casos" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "categorias" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "categorias" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "clientes" ALTER COLUMN "fecha_nacimiento" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clientes" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clientes" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "clientes" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clientes" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "contactos_clientes" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "estudios" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "estudios" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "estudios" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "estudios" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "eventos" ALTER COLUMN "fecha_inicio" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "eventos" ALTER COLUMN "fecha_fin" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "eventos" ALTER COLUMN "recordatorio" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "eventos" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "eventos" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "eventos" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "eventos" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gastos" ALTER COLUMN "fecha_gasto" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gastos" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gastos" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "gastos" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gastos" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "honorarios" ALTER COLUMN "fecha_regulacion" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "honorarios" ALTER COLUMN "fecha_vencimiento" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "honorarios" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "honorarios" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "honorarios" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "honorarios" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ingresos" ALTER COLUMN "fecha_ingreso" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ingresos" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ingresos" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "ingresos" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ingresos" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" ALTER COLUMN "fecha" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" ALTER COLUMN "vencimiento" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "movimientos_vistos" ALTER COLUMN "visto_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movimientos_vistos" ALTER COLUMN "visto_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "notas_caso" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notas_caso" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "notas_cliente" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notas_cliente" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "parametros" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parametros" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ALTER COLUMN "used_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "plan_cuotas" ALTER COLUMN "vencimiento" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "plan_cuotas" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "planes_pago" ALTER COLUMN "fecha_inicio" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "planes_pago" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "planes_pago" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "planes_pago" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "planes_pago" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "planes_suscripcion" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "planes_suscripcion" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "plantillas" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plantillas" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "preferencias_cobranza" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "preferencias_cobranza" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "preferencias_cobranza" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "push_subscriptions" ALTER COLUMN "last_used_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recordatorios_cobranza_log" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recordatorios_cobranza_log" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "rotated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "revoked_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "security_audit" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security_audit" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sisfe_sessions" ALTER COLUMN "last_verified_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sisfe_sessions" ALTER COLUMN "last_sync_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sisfe_sessions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sisfe_sessions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sisfe_sessions" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sisfe_sessions" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "storage_watches" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "storage_watches" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "storage_watches" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "storage_watches" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "storage_watches" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sub_tareas" ALTER COLUMN "completada_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sub_tareas" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "system_error_logs" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "system_error_logs" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "tareas" ALTER COLUMN "fecha_limite" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tareas" ALTER COLUMN "recordatorio" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tareas" ALTER COLUMN "completada_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tareas" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tareas" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "tareas" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tareas" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "terceros" ALTER COLUMN "fecha_nacimiento" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "terceros" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "terceros" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "terceros" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "terceros" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "last_login_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "valores_jus" ALTER COLUMN "fecha" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "valores_jus" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "valores_jus" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "valores_jus" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tareas_movimiento_vivo_unique" ON "tareas" USING btree ("movimiento_id") WHERE "tareas"."deleted_at" IS NULL AND "tareas"."movimiento_id" IS NOT NULL;