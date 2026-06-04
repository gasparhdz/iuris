CREATE TABLE "auditoria_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"usuario_id" integer,
	"entidad" varchar(50) NOT NULL,
	"entidad_id" integer,
	"accion" varchar(50) NOT NULL,
	"descripcion" text,
	"cambios" json,
	"ip" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auditoria_logs" ADD CONSTRAINT "auditoria_logs_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria_logs" ADD CONSTRAINT "auditoria_logs_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;