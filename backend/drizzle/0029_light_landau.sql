ALTER TABLE "participantes_caso" DROP CONSTRAINT "participantes_caso_caso_id_casos_id_fk";
--> statement-breakpoint
ALTER TABLE "participantes_caso" DROP CONSTRAINT "participantes_caso_tercero_id_terceros_id_fk";
--> statement-breakpoint
ALTER TABLE "participantes_caso" ADD COLUMN "estudio_id" integer;--> statement-breakpoint
UPDATE "participantes_caso" pc SET "estudio_id" = c."estudio_id" FROM "casos" c WHERE c."id" = pc."caso_id";--> statement-breakpoint
ALTER TABLE "participantes_caso" ALTER COLUMN "estudio_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "participantes_caso" ADD CONSTRAINT "participantes_caso_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participantes_caso" ADD CONSTRAINT "participantes_caso_caso_estudio_fk" FOREIGN KEY ("caso_id","estudio_id") REFERENCES "public"."casos"("id","estudio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_id_estudio_id_unique" UNIQUE("id","estudio_id");--> statement-breakpoint
ALTER TABLE "participantes_caso" ADD CONSTRAINT "participantes_caso_tercero_estudio_fk" FOREIGN KEY ("tercero_id","estudio_id") REFERENCES "public"."terceros"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participantes_caso_estudio_caso_idx" ON "participantes_caso" USING btree ("estudio_id","caso_id");