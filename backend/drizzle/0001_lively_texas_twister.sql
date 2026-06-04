ALTER TABLE "ingresos" ADD COLUMN "cuota_id" integer;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD COLUMN "monto_jus" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD COLUMN "valor_jus_ref" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD COLUMN "monto_cuota_jus" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "planes_pago" ADD COLUMN "valor_jus_ref" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "planes_pago" ADD COLUMN "politica_jus_id" integer;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_cuota_id_plan_cuotas_id_fk" FOREIGN KEY ("cuota_id") REFERENCES "public"."plan_cuotas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD CONSTRAINT "plan_cuotas_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD CONSTRAINT "plan_cuotas_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cuotas" ADD CONSTRAINT "plan_cuotas_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_politica_jus_id_parametros_id_fk" FOREIGN KEY ("politica_jus_id") REFERENCES "public"."parametros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_cuotas_plan_numero_unique" ON "plan_cuotas" USING btree ("plan_id","numero");