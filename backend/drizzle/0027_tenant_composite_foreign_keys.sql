ALTER TABLE "clientes" ADD CONSTRAINT "clientes_id_estudio_id_unique" UNIQUE ("id", "estudio_id");--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_id_estudio_id_unique" UNIQUE ("id", "estudio_id");--> statement-breakpoint

ALTER TABLE "casos" DROP CONSTRAINT "casos_cliente_id_clientes_id_fk";--> statement-breakpoint
ALTER TABLE "caso_trazabilidad" DROP CONSTRAINT "caso_trazabilidad_caso_id_casos_id_fk";--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" DROP CONSTRAINT "movimientos_judiciales_caso_id_casos_id_fk";--> statement-breakpoint
ALTER TABLE "notas_caso" DROP CONSTRAINT "notas_caso_caso_id_casos_id_fk";--> statement-breakpoint
ALTER TABLE "notas_cliente" DROP CONSTRAINT "notas_cliente_cliente_id_clientes_id_fk";--> statement-breakpoint
ALTER TABLE "eventos" DROP CONSTRAINT "eventos_caso_id_casos_id_fk";--> statement-breakpoint
ALTER TABLE "eventos" DROP CONSTRAINT "eventos_cliente_id_clientes_id_fk";--> statement-breakpoint
ALTER TABLE "tareas" DROP CONSTRAINT "tareas_caso_id_casos_id_fk";--> statement-breakpoint
ALTER TABLE "tareas" DROP CONSTRAINT "tareas_cliente_id_clientes_id_fk";--> statement-breakpoint
ALTER TABLE "honorarios" DROP CONSTRAINT "honorarios_caso_id_casos_id_fk";--> statement-breakpoint
ALTER TABLE "honorarios" DROP CONSTRAINT "honorarios_cliente_id_clientes_id_fk";--> statement-breakpoint
ALTER TABLE "gastos" DROP CONSTRAINT "gastos_caso_id_casos_id_fk";--> statement-breakpoint
ALTER TABLE "gastos" DROP CONSTRAINT "gastos_cliente_id_clientes_id_fk";--> statement-breakpoint
ALTER TABLE "ingresos" DROP CONSTRAINT "ingresos_caso_id_casos_id_fk";--> statement-breakpoint
ALTER TABLE "ingresos" DROP CONSTRAINT "ingresos_cliente_id_clientes_id_fk";--> statement-breakpoint
ALTER TABLE "planes_pago" DROP CONSTRAINT "planes_pago_caso_id_casos_id_fk";--> statement-breakpoint
ALTER TABLE "planes_pago" DROP CONSTRAINT "planes_pago_cliente_id_clientes_id_fk";--> statement-breakpoint

ALTER TABLE "casos" ADD CONSTRAINT "casos_cliente_estudio_fk" FOREIGN KEY ("cliente_id", "estudio_id") REFERENCES "public"."clientes"("id", "estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caso_trazabilidad" ADD CONSTRAINT "caso_trazabilidad_caso_estudio_fk" FOREIGN KEY ("caso_id", "estudio_id") REFERENCES "public"."casos"("id", "estudio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_judiciales" ADD CONSTRAINT "movimientos_judiciales_caso_estudio_fk" FOREIGN KEY ("caso_id", "estudio_id") REFERENCES "public"."casos"("id", "estudio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_caso" ADD CONSTRAINT "notas_caso_caso_estudio_fk" FOREIGN KEY ("caso_id", "estudio_id") REFERENCES "public"."casos"("id", "estudio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_cliente" ADD CONSTRAINT "notas_cliente_cliente_estudio_fk" FOREIGN KEY ("cliente_id", "estudio_id") REFERENCES "public"."clientes"("id", "estudio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_caso_estudio_fk" FOREIGN KEY ("caso_id", "estudio_id") REFERENCES "public"."casos"("id", "estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_cliente_estudio_fk" FOREIGN KEY ("cliente_id", "estudio_id") REFERENCES "public"."clientes"("id", "estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_caso_estudio_fk" FOREIGN KEY ("caso_id", "estudio_id") REFERENCES "public"."casos"("id", "estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_cliente_estudio_fk" FOREIGN KEY ("cliente_id", "estudio_id") REFERENCES "public"."clientes"("id", "estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_caso_estudio_fk" FOREIGN KEY ("caso_id", "estudio_id") REFERENCES "public"."casos"("id", "estudio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_cliente_estudio_fk" FOREIGN KEY ("cliente_id", "estudio_id") REFERENCES "public"."clientes"("id", "estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_caso_estudio_fk" FOREIGN KEY ("caso_id", "estudio_id") REFERENCES "public"."casos"("id", "estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_cliente_estudio_fk" FOREIGN KEY ("cliente_id", "estudio_id") REFERENCES "public"."clientes"("id", "estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_caso_estudio_fk" FOREIGN KEY ("caso_id", "estudio_id") REFERENCES "public"."casos"("id", "estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_cliente_estudio_fk" FOREIGN KEY ("cliente_id", "estudio_id") REFERENCES "public"."clientes"("id", "estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_caso_estudio_fk" FOREIGN KEY ("caso_id", "estudio_id") REFERENCES "public"."casos"("id", "estudio_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes_pago" ADD CONSTRAINT "planes_pago_cliente_estudio_fk" FOREIGN KEY ("cliente_id", "estudio_id") REFERENCES "public"."clientes"("id", "estudio_id") ON DELETE no action ON UPDATE no action;
