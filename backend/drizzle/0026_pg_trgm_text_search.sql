CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

CREATE INDEX "casos_caratula_trgm_idx"
ON "casos"
USING gin ("caratula" gin_trgm_ops)
WHERE "deleted_at" IS NULL;--> statement-breakpoint

CREATE INDEX "casos_nro_expte_norm_trgm_idx"
ON "casos"
USING gin ("nro_expte_norm" gin_trgm_ops)
WHERE "deleted_at" IS NULL;--> statement-breakpoint

CREATE INDEX "casos_estudio_nro_expte_norm_idx"
ON "casos"
USING btree ("estudio_id", "nro_expte_norm")
WHERE "deleted_at" IS NULL AND "nro_expte_norm" IS NOT NULL;--> statement-breakpoint

CREATE INDEX "clientes_nombre_completo_trgm_idx"
ON "clientes"
USING gin ((coalesce("nombre", '') || ' ' || coalesce("apellido", '') || ' ' || coalesce("razon_social", '')) gin_trgm_ops)
WHERE "deleted_at" IS NULL;--> statement-breakpoint

CREATE INDEX "clientes_estudio_dni_idx"
ON "clientes"
USING btree ("estudio_id", "dni")
WHERE "deleted_at" IS NULL AND "dni" IS NOT NULL;--> statement-breakpoint

CREATE INDEX "terceros_nombre_completo_trgm_idx"
ON "terceros"
USING gin ((coalesce("nombre", '') || ' ' || coalesce("apellido", '') || ' ' || coalesce("razon_social", '')) gin_trgm_ops)
WHERE "deleted_at" IS NULL;--> statement-breakpoint

CREATE INDEX "terceros_estudio_dni_idx"
ON "terceros"
USING btree ("estudio_id", "dni")
WHERE "deleted_at" IS NULL AND "dni" IS NOT NULL;
