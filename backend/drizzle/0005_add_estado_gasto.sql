ALTER TABLE "gastos" ADD COLUMN "estado_id" integer;
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_estado_id_parametros_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;
