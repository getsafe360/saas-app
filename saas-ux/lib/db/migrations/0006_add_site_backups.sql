CREATE TYPE "public"."backup_method" AS ENUM('checkpoint', 'wordpress-plugin', 'ssh');--> statement-breakpoint
CREATE TYPE "public"."backup_status" AS ENUM('creating', 'ready', 'restoring', 'failed');--> statement-breakpoint
CREATE TABLE "site_backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"method" "backup_method" DEFAULT 'checkpoint' NOT NULL,
	"status" "backup_status" DEFAULT 'creating' NOT NULL,
	"blob_key" text NOT NULL,
	"includes" jsonb NOT NULL,
	"size_bytes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "site_backups" ADD CONSTRAINT "site_backups_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_backups_site_idx" ON "site_backups" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "site_backups_site_status_idx" ON "site_backups" USING btree ("site_id","status");
