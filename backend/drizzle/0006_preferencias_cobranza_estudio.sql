ALTER TABLE "preferencias_cobranza" ADD COLUMN "estudio_id" integer;--> statement-breakpoint
UPDATE "preferencias_cobranza" pc
SET "estudio_id" = u."estudio_id"
FROM "usuarios" u
WHERE u."id" = pc."usuario_id";--> statement-breakpoint
DELETE FROM "preferencias_cobranza" WHERE "estudio_id" IS NULL;--> statement-breakpoint
ALTER TABLE "preferencias_cobranza" ALTER COLUMN "estudio_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "preferencias_cobranza" ADD CONSTRAINT "preferencias_cobranza_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "preferencias_cobranza_estudio_idx" ON "preferencias_cobranza" USING btree ("estudio_id");
