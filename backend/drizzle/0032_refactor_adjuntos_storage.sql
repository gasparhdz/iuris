ALTER TABLE "adjuntos" RENAME COLUMN "drive_file_id" TO "storage_key";--> statement-breakpoint
ALTER TABLE "adjuntos" RENAME COLUMN "drive_folder_id" TO "storage_folder_key";--> statement-breakpoint
ALTER TABLE "adjuntos" ADD COLUMN "storage_driver" varchar(50) DEFAULT 'google-drive' NOT NULL;--> statement-breakpoint
ALTER TABLE "adjuntos" ADD COLUMN "etag" varchar(255);--> statement-breakpoint
ALTER TABLE "adjuntos" RENAME CONSTRAINT "adjuntos_drive_file_id_unique" TO "adjuntos_storage_key_unique";
