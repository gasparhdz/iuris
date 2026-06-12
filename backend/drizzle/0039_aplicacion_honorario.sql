-- Permite aplicar un cobro (ingreso) directamente a un honorario sin plan de pago.
-- Hasta ahora un ingreso_aplicaciones solo podia apuntar a una cuota o a un gasto.
ALTER TABLE "ingreso_aplicaciones" ADD COLUMN "honorario_id" integer;
--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones"
  ADD CONSTRAINT "ingreso_aplicaciones_honorario_id_honorarios_id_fk"
  FOREIGN KEY ("honorario_id") REFERENCES "honorarios"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ingreso_aplicaciones_estudio_honorario_idx"
  ON "ingreso_aplicaciones" ("estudio_id", "honorario_id")
  WHERE "deleted_at" IS NULL;
