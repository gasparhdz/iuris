ALTER TABLE "ingresos" ADD COLUMN "valor_jus_al_cobro" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "planes_pago" ADD COLUMN "tasa_interes_mensual" numeric(8, 6);--> statement-breakpoint
ALTER TABLE "planes_pago" ADD COLUMN "dia_vencimiento" integer;