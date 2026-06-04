CREATE TABLE "planes_suscripcion" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"max_usuarios" integer NOT NULL,
	"almacenamiento_gb" integer NOT NULL,
	"precio_mensual_ars" numeric(14, 2) NOT NULL,
	"precio_mensual_jus" numeric(14, 4) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "planes_suscripcion_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
ALTER TABLE "estudios" ADD COLUMN "plan_suscripcion_id" integer;--> statement-breakpoint
ALTER TABLE "estudios" ADD COLUMN "plan" varchar(50) DEFAULT 'SOLO' NOT NULL;--> statement-breakpoint
ALTER TABLE "estudios" ADD COLUMN "max_usuarios" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "estudios" ADD COLUMN "almacenamiento_gb" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "estudios" ADD CONSTRAINT "estudios_plan_suscripcion_id_planes_suscripcion_id_fk" FOREIGN KEY ("plan_suscripcion_id") REFERENCES "public"."planes_suscripcion"("id") ON DELETE no action ON UPDATE no action;