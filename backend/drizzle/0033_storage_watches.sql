CREATE TABLE "storage_watches" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"storage_driver" varchar(50) DEFAULT 'google-drive' NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"resource_id" varchar(255),
	"page_token" varchar(255),
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "storage_watches_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
ALTER TABLE "storage_watches" ADD CONSTRAINT "storage_watches_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;
