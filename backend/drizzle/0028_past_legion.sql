ALTER TABLE "plan_cuotas" ADD COLUMN "monto_aplicado" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
-- Backfill: refleja la suma de aplicaciones ACTIVAS (de ingresos vivos) por cuota,
-- misma semantica que findAplicacionesByCuotaActivas.
UPDATE "plan_cuotas" pc
SET "monto_aplicado" = COALESCE((
  SELECT SUM(ia."monto")
  FROM "ingreso_aplicaciones" ia
  JOIN "ingresos" i ON i."id" = ia."ingreso_id"
  WHERE ia."cuota_id" = pc."id"
    AND ia."activo" = true
    AND ia."deleted_at" IS NULL
    AND i."deleted_at" IS NULL
), 0);--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD CONSTRAINT "plan_cuotas_monto_aplicado_check" CHECK ("plan_cuotas"."monto_jus" IS NOT NULL OR "plan_cuotas"."monto_pesos" IS NULL OR "plan_cuotas"."monto_aplicado" <= "plan_cuotas"."monto_pesos" + 0.01);