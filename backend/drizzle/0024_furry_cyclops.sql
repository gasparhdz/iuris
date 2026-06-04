CREATE TABLE "security_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer DEFAULT 0 NOT NULL,
	"usuario_id" integer,
	"evento" varchar(80) NOT NULL,
	"metodo" varchar(10),
	"path" varchar(500),
	"ip" varchar(100),
	"user_agent" varchar(500),
	"status_code" integer,
	"target_estudio_id" integer,
	"metadata" json,
	"previous_hash" varchar(64),
	"row_hash" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "responsable_id" integer;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "jti_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" uuid;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "rotated_at" timestamp;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "security_audit" ADD CONSTRAINT "security_audit_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_audit_estudio_created_idx" ON "security_audit" USING btree ("estudio_id","created_at");--> statement-breakpoint
CREATE INDEX "security_audit_usuario_evento_idx" ON "security_audit" USING btree ("usuario_id","evento");--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_jti_hash_unique" ON "refresh_tokens" USING btree ("jti_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
ALTER TABLE "refresh_tokens" DROP COLUMN "token_hash";