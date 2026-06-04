CREATE TABLE "caso_trazabilidad" (
	"id" serial PRIMARY KEY NOT NULL,
	"caso_id" integer NOT NULL,
	"estudio_id" integer NOT NULL,
	"ubicacion" varchar(500) NOT NULL,
	"fecha_desde" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "sisfe_radicado_en" varchar(500);--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "sisfe_localidad" varchar(255);--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "sisfe_fecha_ingreso_meu" timestamp;--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "sisfe_ubicacion_actual" varchar(500);--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "sisfe_fecha_ubicacion_actual" timestamp;--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "sisfe_solo_digital" boolean;--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "sisfe_fecha_ultima_actualizacion" timestamp;--> statement-breakpoint
ALTER TABLE "caso_trazabilidad" ADD CONSTRAINT "caso_trazabilidad_caso_id_casos_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caso_trazabilidad" ADD CONSTRAINT "caso_trazabilidad_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE cascade ON UPDATE no action;