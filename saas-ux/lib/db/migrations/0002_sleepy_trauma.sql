CREATE TYPE "public"."report_format" AS ENUM('pdf', 'csv', 'html');--> statement-breakpoint
CREATE TYPE "public"."report_scope" AS ENUM('full', 'performance', 'security', 'seo', 'accessibility', 'custom');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "generated_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"site_id" uuid NOT NULL,
	"format" "report_format" NOT NULL,
	"scope" "report_scope" DEFAULT 'full' NOT NULL,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"title" varchar(300),
	"filename" varchar(255),
	"blob_url" text,
	"blob_key" varchar(500),
	"metadata" jsonb,
	"error_message" text,
	"branding_applied" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"generated_at" timestamp,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "performance_scorecards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"scorecard" jsonb NOT NULL,
	"total_score" real NOT NULL,
	"grade" integer NOT NULL,
	"device" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"company_name" varchar(200) NOT NULL,
	"logo_url" text,
	"logo_light_url" text,
	"config" jsonb DEFAULT '{"colors":{"primary":"#2563eb","secondary":"#1e40af","accent":"#3b82f6","background":"#ffffff","text":"#1f2937"},"contact":{},"showPoweredBy":true}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_branding_team_id_unique" UNIQUE("team_id")
);
--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "plan_name" SET DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "plan_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "subscription_status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "subscription_status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "tokens_remaining" SET DEFAULT 5000;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "tokens_included" integer DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "tokens_used_this_month" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "tokens_purchased" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "billing_cycle_start" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "notified_at_80_percent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "notified_at_100_percent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_scorecards" ADD CONSTRAINT "performance_scorecards_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_branding" ADD CONSTRAINT "report_branding_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generated_reports_team_idx" ON "generated_reports" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "generated_reports_user_idx" ON "generated_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generated_reports_site_idx" ON "generated_reports" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "generated_reports_status_idx" ON "generated_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generated_reports_created_idx" ON "generated_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "performance_scorecards_site_idx" ON "performance_scorecards" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "performance_scorecards_score_idx" ON "performance_scorecards" USING btree ("total_score");--> statement-breakpoint
CREATE INDEX "performance_scorecards_created_idx" ON "performance_scorecards" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "report_branding_team_idx" ON "report_branding" USING btree ("team_id");