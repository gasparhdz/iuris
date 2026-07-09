CREATE TABLE "preferencias_cobranza" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"habilitado" boolean DEFAULT true NOT NULL,
	"dias_anticipacion" integer DEFAULT 3 NOT NULL,
	"por_email" boolean DEFAULT true NOT NULL,
	"por_push" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "recordatorios_cobranza_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "preferencias_cobranza" ADD CONSTRAINT "preferencias_cobranza_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordatorios_cobranza_log" ADD CONSTRAINT "recordatorios_cobranza_log_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "preferencias_cobranza_usuario_unique" ON "preferencias_cobranza" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recordatorios_cobranza_log_usuario_fecha_unique" ON "recordatorios_cobranza_log" USING btree ("usuario_id","fecha");