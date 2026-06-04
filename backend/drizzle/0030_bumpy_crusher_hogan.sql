ALTER TABLE "ingreso_aplicaciones" ADD COLUMN "monto_capital" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD COLUMN "monto_interes" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
UPDATE "ingreso_aplicaciones" SET "monto_capital" = "monto", "monto_interes" = 0;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD COLUMN "regimen_mora" text DEFAULT 'SIMPLE' NOT NULL;
