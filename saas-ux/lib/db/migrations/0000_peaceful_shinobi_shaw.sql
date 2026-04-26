CREATE TYPE "public"."report_format" AS ENUM('pdf', 'csv', 'html', 'markdown');--> statement-breakpoint
CREATE TYPE "public"."report_scope" AS ENUM('full', 'performance', 'security', 'seo', 'accessibility', 'custom');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."token_transaction_type" AS ENUM('purchase', 'auto_replenish', 'bonus', 'admin_adjustment', 'burn');--> statement-breakpoint
CREATE TYPE "public"."activity_event" AS ENUM('site_created', 'site_updated', 'site_deleted', 'connected', 'disconnected', 'scan_started', 'scan_finished', 'scan_failed', 'fix_started', 'fix_finished', 'fix_failed', 'changeset_created', 'changeset_approved', 'changeset_applied', 'changeset_rolled_back', 'changeset_failed', 'pack_installed', 'pack_uninstalled', 'pack_run_started', 'pack_run_finished', 'pack_run_failed');--> statement-breakpoint
CREATE TYPE "public"."agent" AS ENUM('external', 'fallback', 'internal');--> statement-breakpoint
CREATE TYPE "public"."ai_job_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ai_repair_status" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."changeset_status" AS ENUM('draft', 'approved', 'applied', 'rolled_back', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'done', 'error', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."site_status" AS ENUM('pending', 'connected', 'disconnected');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"team_id" integer,
	"site_id" uuid,
	"event" "activity_event" NOT NULL,
	"data" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" integer NOT NULL,
	"target_type" varchar(32) NOT NULL,
	"target_id" varchar(64) NOT NULL,
	"action" varchar(64) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" integer NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" varchar(64) NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"user_id" integer,
	"job_id" text,
	"status" "ai_job_status" DEFAULT 'pending' NOT NULL,
	"selected_modules" jsonb,
	"locale" text DEFAULT 'en',
	"analysis_depth" text DEFAULT 'balanced',
	"safe_mode" boolean DEFAULT true NOT NULL,
	"results" jsonb,
	"issues_found" integer,
	"repairable_issues" integer,
	"tokens_used" integer,
	"provider" text,
	"model_id" text,
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
	"seo_section" text,
	"category" text,
	"action_id" text,
	"title" text,
	"severity" text,
	"score" integer,
	"impact" text,
	"automated_fix" jsonb,
	"status" "ai_repair_status" DEFAULT 'pending' NOT NULL,
	"repair_method" text,
	"changes" jsonb,
	"error_message" text,
	"tokens_used" integer,
	"provider" text,
	"model_id" text,
	"added_to_repair_queue" boolean DEFAULT false NOT NULL,
	"executed_at" timestamp,
	"safe_mode_skipped" boolean DEFAULT false NOT NULL,
	"report_included" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_pack_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"billing" varchar(16) NOT NULL,
	"amount_cents" integer NOT NULL,
	"region" varchar(2),
	"stripe_product_id" varchar(128),
	"stripe_price_id" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "app_pack_translations" (
	"pack_id" uuid NOT NULL,
	"locale" varchar(10) NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "app_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"category" varchar(50),
	"version" varchar(20) DEFAULT '1.0.0' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"price_currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"billing" varchar(16) DEFAULT 'monthly' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_packs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "blob_gc" (
	"key" text PRIMARY KEY NOT NULL,
	"delete_after" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"changeset_id" uuid NOT NULL,
	"op" varchar(16) NOT NULL,
	"path" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"title" varchar(200),
	"description" text,
	"status" "changeset_status" DEFAULT 'draft' NOT NULL,
	"base_snapshot_id" uuid,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "edit_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"changeset_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"agent_used" "agent",
	"error_message" text,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fix_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"team_id" integer,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"kind" varchar(32),
	"issues" jsonb NOT NULL,
	"est_tokens" integer DEFAULT 0 NOT NULL,
	"agent_used" "agent",
	"result_blob_key" varchar(256),
	"error_message" text,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "guest_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_session_id" uuid NOT NULL,
	"site_url" text NOT NULL,
	"canonical_host" text DEFAULT '' NOT NULL,
	"canonical_root" text DEFAULT '' NOT NULL,
	"categories" text NOT NULL,
	"status" varchar(16) DEFAULT 'done' NOT NULL,
	"report_blob_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_token" varchar(64) NOT NULL,
	"ip" varchar(45),
	"ua" text,
	"ref" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_claimed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp,
	"claimed_by_user_id" integer
);
--> statement-breakpoint
CREATE TABLE "idempotency" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"scope" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"invited_by" integer NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"pack_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"result_blob_key" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "payment_method_translations" (
	"method_code" varchar(32) NOT NULL,
	"locale" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"provider" varchar(32) DEFAULT 'stripe' NOT NULL,
	"category" varchar(32) DEFAULT 'bank' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"icon_hint" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "plan_pack_inclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"pack_id" uuid NOT NULL,
	"included" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"billing" varchar(16) NOT NULL,
	"amount_cents" integer NOT NULL,
	"region" varchar(2),
	"stripe_product_id" varchar(128),
	"stripe_price_id" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "plan_translations" (
	"plan_id" uuid NOT NULL,
	"locale" varchar(10) NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "region_payment_methods" (
	"region" varchar(2) NOT NULL,
	"method_code" varchar(32) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL
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
CREATE TABLE "scan_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"categories" text NOT NULL,
	"agent_used" "agent",
	"cost_tokens" integer DEFAULT 0 NOT NULL,
	"report_blob_key" text,
	"error_message" text,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_summaries" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"cms" varchar(32),
	"screenshot_url" text,
	"favicon_url" text,
	"scores" jsonb,
	"findings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_scans" (
	"site_id" uuid PRIMARY KEY NOT NULL,
	"frequency" varchar(16) DEFAULT 'monthly' NOT NULL,
	"next_run_at" timestamp NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"pack_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'installed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_status" varchar(20) DEFAULT 'disconnected',
	"last_connected_at" timestamp,
	"connection_error" text,
	"retry_count" integer DEFAULT 0,
	"external_id" text,
	"user_id" integer NOT NULL,
	"site_url" text NOT NULL,
	"canonical_host" text DEFAULT '' NOT NULL,
	"canonical_root" text DEFAULT '' NOT NULL,
	"status" "site_status" DEFAULT 'pending' NOT NULL,
	"cms" varchar(20),
	"wp_version" varchar(20),
	"plugin_version" varchar(20),
	"token_hash" varchar(64),
	"is_connected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_scan_job_id" uuid,
	"last_scores" jsonb,
	"last_cms" varchar(32),
	"last_screenshot_url" text,
	"last_favicon_url" text,
	"last_finding_count" integer,
	"last_summary" text,
	"wordpress_connection" jsonb,
	"ai_repair_enabled" boolean DEFAULT false,
	"last_ai_analysis" timestamp
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"path" text NOT NULL,
	"blob_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supported_locales" (
	"code" varchar(10) PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_display_policies" (
	"country" varchar(2) PRIMARY KEY NOT NULL,
	"tax_label" varchar(32) DEFAULT 'tax_included' NOT NULL,
	"collect_vat_id" boolean DEFAULT false NOT NULL,
	"collect_national_id" boolean DEFAULT false NOT NULL,
	"reverse_charge_eligible" boolean DEFAULT false NOT NULL,
	"note" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"role" varchar(50) NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"stripe_customer_id" varchar(128),
	"stripe_subscription_id" varchar(128),
	"trial_ends_at" timestamp,
	"current_period_end" timestamp,
	"cancel_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_product_id" text,
	"plan_name" varchar(50) DEFAULT 'free' NOT NULL,
	"subscription_status" varchar(20) DEFAULT 'active' NOT NULL,
	"tokens_included" integer DEFAULT 5000 NOT NULL,
	"tokens_used_this_month" integer DEFAULT 0 NOT NULL,
	"tokens_purchased" integer DEFAULT 0 NOT NULL,
	"tokens_purchased_this_month" integer DEFAULT 0 NOT NULL,
	"tokens_purchased_this_month_eur" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tokens_remaining" integer DEFAULT 5000 NOT NULL,
	"auto_replenish_enabled" boolean DEFAULT false NOT NULL,
	"show_low_token_banner" boolean DEFAULT false NOT NULL,
	"last_purchased_pack_id" varchar(50),
	"billing_cycle_start" timestamp DEFAULT now() NOT NULL,
	"notified_at_80_percent" boolean DEFAULT false NOT NULL,
	"notified_at_100_percent" boolean DEFAULT false NOT NULL,
	CONSTRAINT "teams_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "teams_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "token_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"amount_tokens" integer NOT NULL,
	"amount_eur" numeric(10, 2),
	"type" "token_transaction_type" NOT NULL,
	"stripe_payment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100),
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan_name" varchar(50),
	"subscription_status" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "users_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(32) DEFAULT 'stripe' NOT NULL,
	"event_id" varchar(128) NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"status" varchar(16) DEFAULT 'stored' NOT NULL,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_jobs" ADD CONSTRAINT "ai_analysis_jobs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_jobs" ADD CONSTRAINT "ai_analysis_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_repair_actions" ADD CONSTRAINT "ai_repair_actions_analysis_job_id_ai_analysis_jobs_id_fk" FOREIGN KEY ("analysis_job_id") REFERENCES "public"."ai_analysis_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_repair_actions" ADD CONSTRAINT "ai_repair_actions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_pack_prices" ADD CONSTRAINT "app_pack_prices_pack_id_app_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."app_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_pack_translations" ADD CONSTRAINT "app_pack_translations_pack_id_app_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."app_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_items" ADD CONSTRAINT "change_items_changeset_id_change_sets_id_fk" FOREIGN KEY ("changeset_id") REFERENCES "public"."change_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_base_snapshot_id_snapshots_id_fk" FOREIGN KEY ("base_snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cockpit_layouts" ADD CONSTRAINT "cockpit_layouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cockpit_layouts" ADD CONSTRAINT "cockpit_layouts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_logs" ADD CONSTRAINT "connection_logs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_jobs" ADD CONSTRAINT "edit_jobs_changeset_id_change_sets_id_fk" FOREIGN KEY ("changeset_id") REFERENCES "public"."change_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fix_jobs" ADD CONSTRAINT "fix_jobs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fix_jobs" ADD CONSTRAINT "fix_jobs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_scans" ADD CONSTRAINT "guest_scans_guest_session_id_guest_sessions_id_fk" FOREIGN KEY ("guest_session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_runs" ADD CONSTRAINT "pack_runs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_runs" ADD CONSTRAINT "pack_runs_pack_id_app_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."app_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_method_translations" ADD CONSTRAINT "payment_method_translations_method_code_payment_methods_code_fk" FOREIGN KEY ("method_code") REFERENCES "public"."payment_methods"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_scorecards" ADD CONSTRAINT "performance_scorecards_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_pack_inclusions" ADD CONSTRAINT "plan_pack_inclusions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_pack_inclusions" ADD CONSTRAINT "plan_pack_inclusions_pack_id_app_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."app_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_translations" ADD CONSTRAINT "plan_translations_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_payment_methods" ADD CONSTRAINT "region_payment_methods_method_code_payment_methods_code_fk" FOREIGN KEY ("method_code") REFERENCES "public"."payment_methods"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_branding" ADD CONSTRAINT "report_branding_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_summaries" ADD CONSTRAINT "scan_summaries_job_id_scan_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_summaries" ADD CONSTRAINT "scan_summaries_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_scans" ADD CONSTRAINT "scheduled_scans_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_packs" ADD CONSTRAINT "site_packs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_packs" ADD CONSTRAINT "site_packs_pack_id_app_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."app_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_subscriptions" ADD CONSTRAINT "team_subscriptions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_subscriptions" ADD CONSTRAINT "team_subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_site_idx" ON "activity_logs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "activity_user_idx" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_event_idx" ON "activity_logs" USING btree ("event");--> statement-breakpoint
CREATE INDEX "admin_actions_actor_idx" ON "admin_actions" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "admin_actions_target_idx" ON "admin_actions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "admin_notes_entity_idx" ON "admin_notes" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ai_analysis_jobs_site_idx" ON "ai_analysis_jobs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "ai_analysis_jobs_status_idx" ON "ai_analysis_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_analysis_jobs_job_id_idx" ON "ai_analysis_jobs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ai_repair_actions_analysis_job_idx" ON "ai_repair_actions" USING btree ("analysis_job_id");--> statement-breakpoint
CREATE INDEX "ai_repair_actions_site_idx" ON "ai_repair_actions" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "ai_repair_actions_status_idx" ON "ai_repair_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_repair_actions_section_idx" ON "ai_repair_actions" USING btree ("seo_section");--> statement-breakpoint
CREATE UNIQUE INDEX "app_pack_prices_pack_cur_bill_reg_uq" ON "app_pack_prices" USING btree ("pack_id","currency","billing","region");--> statement-breakpoint
CREATE INDEX "app_pack_prices_pack_idx" ON "app_pack_prices" USING btree ("pack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "apt_pack_locale_uq" ON "app_pack_translations" USING btree ("pack_id","locale");--> statement-breakpoint
CREATE INDEX "apt_pack_idx" ON "app_pack_translations" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "blob_gc_when_idx" ON "blob_gc" USING btree ("delete_after");--> statement-breakpoint
CREATE INDEX "change_items_cs_idx" ON "change_items" USING btree ("changeset_id");--> statement-breakpoint
CREATE INDEX "change_sets_site_idx" ON "change_sets" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "change_sets_status_idx" ON "change_sets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cockpit_layouts_user_idx" ON "cockpit_layouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cockpit_layouts_site_idx" ON "cockpit_layouts" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "edit_jobs_cs_idx" ON "edit_jobs" USING btree ("changeset_id");--> statement-breakpoint
CREATE INDEX "fix_jobs_site_idx" ON "fix_jobs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "fix_jobs_team_idx" ON "fix_jobs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "fix_jobs_status_idx" ON "fix_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generated_reports_team_idx" ON "generated_reports" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "generated_reports_user_idx" ON "generated_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generated_reports_site_idx" ON "generated_reports" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "generated_reports_status_idx" ON "generated_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generated_reports_created_idx" ON "generated_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "guest_scans_session_idx" ON "guest_scans" USING btree ("guest_session_id");--> statement-breakpoint
CREATE INDEX "guest_scans_host_idx" ON "guest_scans" USING btree ("canonical_host");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_sessions_claim_token_uq" ON "guest_sessions" USING btree ("claim_token");--> statement-breakpoint
CREATE INDEX "guest_sessions_expires_idx" ON "guest_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "guest_sessions_claimable_idx" ON "guest_sessions" USING btree ("is_claimed","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_team_email_uq" ON "invitations" USING btree ("team_id","email");--> statement-breakpoint
CREATE INDEX "pack_runs_site_idx" ON "pack_runs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "pack_runs_pack_idx" ON "pack_runs" USING btree ("pack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pmt_method_locale_uq" ON "payment_method_translations" USING btree ("method_code","locale");--> statement-breakpoint
CREATE INDEX "performance_scorecards_site_idx" ON "performance_scorecards" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "performance_scorecards_score_idx" ON "performance_scorecards" USING btree ("total_score");--> statement-breakpoint
CREATE INDEX "performance_scorecards_created_idx" ON "performance_scorecards" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_pack_inclusion_uq" ON "plan_pack_inclusions" USING btree ("plan_id","pack_id");--> statement-breakpoint
CREATE INDEX "plan_pack_plan_idx" ON "plan_pack_inclusions" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_prices_plan_cur_bill_reg_uq" ON "plan_prices" USING btree ("plan_id","currency","billing","region");--> statement-breakpoint
CREATE INDEX "plan_prices_plan_idx" ON "plan_prices" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_translations_plan_locale_uq" ON "plan_translations" USING btree ("plan_id","locale");--> statement-breakpoint
CREATE INDEX "plan_translations_plan_idx" ON "plan_translations" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rpm_region_method_uq" ON "region_payment_methods" USING btree ("region","method_code");--> statement-breakpoint
CREATE INDEX "report_branding_team_idx" ON "report_branding" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "scan_jobs_site_idx" ON "scan_jobs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "scan_jobs_status_idx" ON "scan_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scan_summaries_site_idx" ON "scan_summaries" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "scan_summaries_site_created_idx" ON "scan_summaries" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "scheduled_scans_runnable_idx" ON "scheduled_scans" USING btree ("is_enabled","next_run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "site_packs_site_pack_uq" ON "site_packs" USING btree ("site_id","pack_id");--> statement-breakpoint
CREATE INDEX "site_packs_site_idx" ON "site_packs" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_user_host_uq" ON "sites" USING btree ("user_id","canonical_host");--> statement-breakpoint
CREATE INDEX "sites_user_idx" ON "sites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sites_host_idx" ON "sites" USING btree ("canonical_host");--> statement-breakpoint
CREATE INDEX "sites_last_job_idx" ON "sites" USING btree ("last_scan_job_id");--> statement-breakpoint
CREATE INDEX "sites_connection_status_idx" ON "sites" USING btree ("connection_status");--> statement-breakpoint
CREATE INDEX "snapshots_site_idx" ON "snapshots" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "supported_locales_enabled_idx" ON "supported_locales" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_user_uq" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "team_subs_team_idx" ON "team_subscriptions" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_event_provider_id_uq" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "webhook_event_type_idx" ON "webhook_events" USING btree ("event_type");