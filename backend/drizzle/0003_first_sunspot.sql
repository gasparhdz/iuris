CREATE TABLE "contactos_clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" integer NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"rol" varchar(100),
	"email" varchar(255),
	"telefono" varchar(50),
	"observaciones" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "contactos_clientes" ADD CONSTRAINT "contactos_clientes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;