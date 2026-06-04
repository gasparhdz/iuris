ALTER TABLE "ingreso_aplicaciones" ALTER COLUMN "cuota_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD COLUMN "gasto_id" integer;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_gasto_id_gastos_id_fk" FOREIGN KEY ("gasto_id") REFERENCES "public"."gastos"("id") ON DELETE cascade ON UPDATE no action;