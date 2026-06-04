CREATE TABLE "ingreso_aplicaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"ingreso_id" integer NOT NULL,
	"cuota_id" integer NOT NULL,
	"monto" numeric(14, 2) NOT NULL,
	"valor_jus_al_cobro" numeric(14, 4),
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp,
	"updated_by" integer,
	"deleted_at" timestamp,
	"deleted_by" integer
);
--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_ingreso_id_ingresos_id_fk" FOREIGN KEY ("ingreso_id") REFERENCES "public"."ingresos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_cuota_id_plan_cuotas_id_fk" FOREIGN KEY ("cuota_id") REFERENCES "public"."plan_cuotas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingreso_aplicaciones" ADD CONSTRAINT "ingreso_aplicaciones_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "ingreso_aplicaciones" (
	"estudio_id",
	"ingreso_id",
	"cuota_id",
	"monto",
	"valor_jus_al_cobro",
	"activo",
	"created_at",
	"created_by"
)
SELECT
	"estudio_id",
	"id",
	"cuota_id",
	"monto",
	"valor_jus_al_cobro",
	"activo",
	"created_at",
	"created_by"
FROM "ingresos"
WHERE "cuota_id" IS NOT NULL
  AND "deleted_at" IS NULL
  AND "activo" = true;
