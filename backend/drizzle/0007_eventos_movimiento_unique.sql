ALTER TABLE "eventos" ADD COLUMN "movimiento_id" integer;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_movimiento_id_movimientos_judiciales_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos_judiciales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eventos_movimiento_idx" ON "eventos" USING btree ("movimiento_id") WHERE "eventos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "eventos_movimiento_vivo_unique" ON "eventos" USING btree ("movimiento_id") WHERE "eventos"."deleted_at" IS NULL AND "eventos"."movimiento_id" IS NOT NULL;
