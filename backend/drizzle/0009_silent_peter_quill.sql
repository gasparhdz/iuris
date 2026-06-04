CREATE TABLE "system_error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"nivel" varchar(20) NOT NULL,
	"status_code" integer NOT NULL,
	"error_code" varchar(100),
	"mensaje" text NOT NULL,
	"metodo" varchar(10),
	"ruta" varchar(500),
	"ip" varchar(100),
	"usuario_id" integer,
	"estudio_id" integer,
	"stack_trace" text,
	"contexto" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_error_logs" ADD CONSTRAINT "system_error_logs_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_error_logs" ADD CONSTRAINT "system_error_logs_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE set null ON UPDATE no action;