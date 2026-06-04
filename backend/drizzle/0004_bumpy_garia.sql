ALTER TABLE "casos" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "ingresos" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "ingresos" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "ingresos" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "ingresos" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "ingresos" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "tareas" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "tareas" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "tareas" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "terceros" ADD COLUMN "deleted_by" integer;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ADD CONSTRAINT "contactos_clientes_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ADD CONSTRAINT "contactos_clientes_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contactos_clientes" ADD CONSTRAINT "contactos_clientes_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_created_by_usuarios_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_updated_by_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_deleted_by_usuarios_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;