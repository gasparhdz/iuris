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
CREATE INDEX "ingresos_estudio_created_idx" ON "ingresos" USING btree ("estudio_id","created_at") WHERE "ingresos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ingresos_estudio_cliente_idx" ON "ingresos" USING btree ("estudio_id","cliente_id") WHERE "ingresos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "ingresos_estudio_caso_idx" ON "ingresos" USING btree ("estudio_id","caso_id") WHERE "ingresos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "movimientos_judiciales_estudio_created_idx" ON "movimientos_judiciales" USING btree ("estudio_id","created_at");--> statement-breakpoint
CREATE INDEX "movimientos_judiciales_estudio_caso_idx" ON "movimientos_judiciales" USING btree ("estudio_id","caso_id");--> statement-breakpoint
CREATE INDEX "plan_cuotas_plan_created_idx" ON "plan_cuotas" USING btree ("plan_id","created_at") WHERE "plan_cuotas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "planes_pago_estudio_created_idx" ON "planes_pago" USING btree ("estudio_id","created_at") WHERE "planes_pago"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "planes_pago_estudio_cliente_idx" ON "planes_pago" USING btree ("estudio_id","cliente_id") WHERE "planes_pago"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "planes_pago_estudio_caso_idx" ON "planes_pago" USING btree ("estudio_id","caso_id") WHERE "planes_pago"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tareas_estudio_created_idx" ON "tareas" USING btree ("estudio_id","created_at") WHERE "tareas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tareas_estudio_caso_idx" ON "tareas" USING btree ("estudio_id","caso_id") WHERE "tareas"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tareas_estudio_cliente_idx" ON "tareas" USING btree ("estudio_id","cliente_id") WHERE "tareas"."deleted_at" IS NULL;