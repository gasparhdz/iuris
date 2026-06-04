CREATE TABLE "sisfe_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"estudio_id" integer NOT NULL,
	"session_cookie_encriptada" text NOT NULL,
	"cookie_name" varchar(100) NOT NULL,
	"last_verified_at" timestamp,
	"last_sync_at" timestamp,
	"sync_status" varchar(20) DEFAULT 'idle' NOT NULL,
	"sync_progress" integer DEFAULT 0 NOT NULL,
	"sync_message" text,
	"sync_stats" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "sisfe_expte_id" varchar(50);--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "sisfe_last_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "sisfe_synced_by" integer;--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" ADD COLUMN "sisfe_mov_id" varchar(500);--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" ADD COLUMN "origen_sisfe" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sisfe_sessions" ADD CONSTRAINT "sisfe_sessions_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sisfe_sessions" ADD CONSTRAINT "sisfe_sessions_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sisfe_sessions_usuario_unique" ON "sisfe_sessions" USING btree ("usuario_id");--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_sisfe_synced_by_usuarios_id_fk" FOREIGN KEY ("sisfe_synced_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;