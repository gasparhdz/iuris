DROP INDEX IF EXISTS "valores_jus_estudio_fecha_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "valores_jus_estudio_fecha_unique" ON "valores_jus" USING btree ("estudio_id","fecha") WHERE "deleted_at" IS NULL;
