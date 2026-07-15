ALTER TABLE "ingresos" ADD COLUMN "obligado_cliente_id" integer;--> statement-breakpoint
ALTER TABLE "ingresos" ADD COLUMN "obligado_tercero_id" integer;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_obligado_cliente_estudio_fk" FOREIGN KEY ("obligado_cliente_id","estudio_id") REFERENCES "public"."clientes"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_obligado_tercero_estudio_fk" FOREIGN KEY ("obligado_tercero_id","estudio_id") REFERENCES "public"."terceros"("id","estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_obligado_xor_check" CHECK (("ingresos"."obligado_cliente_id" IS NULL OR "ingresos"."obligado_tercero_id" IS NULL));
