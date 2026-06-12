ALTER TABLE "tareas" ADD COLUMN "movimiento_id" integer;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_movimiento_id_movimientos_judiciales_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos_judiciales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tareas_movimiento_idx" ON "tareas" USING btree ("movimiento_id") WHERE "deleted_at" IS NULL;
