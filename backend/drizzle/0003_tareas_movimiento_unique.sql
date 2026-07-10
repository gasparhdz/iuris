CREATE UNIQUE INDEX "tareas_movimiento_vivo_unique" ON "tareas" USING btree ("movimiento_id") WHERE "tareas"."deleted_at" IS NULL AND "tareas"."movimiento_id" IS NOT NULL;
