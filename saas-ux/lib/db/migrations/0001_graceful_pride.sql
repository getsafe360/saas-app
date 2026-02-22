CREATE TYPE "public"."ai_job_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ai_repair_status" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "ai_analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"user_id" integer,
	"job_id" text,
	"status" "ai_job_status" DEFAULT 'pending' NOT NULL,
	"selected_modules" jsonb,
	"results" jsonb,
	"issues_found" integer,
	"repairable_issues" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_analysis_jobs_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "ai_repair_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_job_id" uuid,
	"site_id" uuid,
	"issue_id" text,
	"category" text,
	"status" "ai_repair_status" DEFAULT 'pending' NOT NULL,
	"repair_method" text,
	"changes" jsonb,
	"error_message" text,
	"executed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cockpit_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"site_id" uuid,
	"layout" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cockpit_layouts_user_site_uq" UNIQUE("user_id","site_id")
);
--> statement-breakpoint
CREATE TABLE "connection_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"success" boolean NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "connection_status" varchar(20) DEFAULT 'disconnected';--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "last_connected_at" timestamp;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "connection_error" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "retry_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "wordpress_connection" jsonb;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "ai_repair_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "last_ai_analysis" timestamp;--> statement-breakpoint
ALTER TABLE "ai_analysis_jobs" ADD CONSTRAINT "ai_analysis_jobs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_jobs" ADD CONSTRAINT "ai_analysis_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_repair_actions" ADD CONSTRAINT "ai_repair_actions_analysis_job_id_ai_analysis_jobs_id_fk" FOREIGN KEY ("analysis_job_id") REFERENCES "public"."ai_analysis_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_repair_actions" ADD CONSTRAINT "ai_repair_actions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cockpit_layouts" ADD CONSTRAINT "cockpit_layouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cockpit_layouts" ADD CONSTRAINT "cockpit_layouts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_logs" ADD CONSTRAINT "connection_logs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_analysis_jobs_site_idx" ON "ai_analysis_jobs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "ai_analysis_jobs_status_idx" ON "ai_analysis_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_analysis_jobs_job_id_idx" ON "ai_analysis_jobs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ai_repair_actions_analysis_job_idx" ON "ai_repair_actions" USING btree ("analysis_job_id");--> statement-breakpoint
CREATE INDEX "ai_repair_actions_site_idx" ON "ai_repair_actions" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "ai_repair_actions_status_idx" ON "ai_repair_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cockpit_layouts_user_idx" ON "cockpit_layouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cockpit_layouts_site_idx" ON "cockpit_layouts" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "sites_connection_status_idx" ON "sites" USING btree ("connection_status");