CREATE TABLE "movimientos_vistos" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"movimiento_id" integer NOT NULL,
	"usuario_id" integer NOT NULL,
	"visto_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movimientos_vistos" ADD CONSTRAINT "movimientos_vistos_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_vistos" ADD CONSTRAINT "movimientos_vistos_movimiento_id_movimientos_judiciales_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos_judiciales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_vistos" ADD CONSTRAINT "movimientos_vistos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "movimientos_vistos_usuario_mov_unico" ON "movimientos_vistos" USING btree ("usuario_id","movimiento_id");--> statement-breakpoint
CREATE INDEX "movimientos_vistos_estudio_usuario_idx" ON "movimientos_vistos" USING btree ("estudio_id","usuario_id");
