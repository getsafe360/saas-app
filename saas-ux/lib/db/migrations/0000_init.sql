CREATE TYPE "public"."activity_event" AS ENUM('site_created', 'site_updated', 'site_deleted', 'connected', 'disconnected', 'scan_started', 'scan_finished', 'scan_failed', 'fix_started', 'fix_finished', 'fix_failed', 'changeset_created', 'changeset_approved', 'changeset_applied', 'changeset_rolled_back', 'changeset_failed', 'pack_installed', 'pack_uninstalled', 'pack_run_started', 'pack_run_finished', 'pack_run_failed');--> statement-breakpoint
CREATE TYPE "public"."agent" AS ENUM('external', 'fallback', 'internal');--> statement-breakpoint
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
	"last_finding_count" integer
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
	"plan_name" varchar(50),
	"subscription_status" varchar(20),
	"tokens_remaining" integer DEFAULT 50000 NOT NULL,
	CONSTRAINT "teams_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "teams_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
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
ALTER TABLE "app_pack_prices" ADD CONSTRAINT "app_pack_prices_pack_id_app_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."app_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_pack_translations" ADD CONSTRAINT "app_pack_translations_pack_id_app_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."app_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_items" ADD CONSTRAINT "change_items_changeset_id_change_sets_id_fk" FOREIGN KEY ("changeset_id") REFERENCES "public"."change_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_base_snapshot_id_snapshots_id_fk" FOREIGN KEY ("base_snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_jobs" ADD CONSTRAINT "edit_jobs_changeset_id_change_sets_id_fk" FOREIGN KEY ("changeset_id") REFERENCES "public"."change_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fix_jobs" ADD CONSTRAINT "fix_jobs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fix_jobs" ADD CONSTRAINT "fix_jobs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_scans" ADD CONSTRAINT "guest_scans_guest_session_id_guest_sessions_id_fk" FOREIGN KEY ("guest_session_id") REFERENCES "public"."guest_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_runs" ADD CONSTRAINT "pack_runs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_runs" ADD CONSTRAINT "pack_runs_pack_id_app_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."app_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_method_translations" ADD CONSTRAINT "payment_method_translations_method_code_payment_methods_code_fk" FOREIGN KEY ("method_code") REFERENCES "public"."payment_methods"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_pack_inclusions" ADD CONSTRAINT "plan_pack_inclusions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_pack_inclusions" ADD CONSTRAINT "plan_pack_inclusions_pack_id_app_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."app_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_translations" ADD CONSTRAINT "plan_translations_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_payment_methods" ADD CONSTRAINT "region_payment_methods_method_code_payment_methods_code_fk" FOREIGN KEY ("method_code") REFERENCES "public"."payment_methods"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "activity_site_idx" ON "activity_logs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "activity_user_idx" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_event_idx" ON "activity_logs" USING btree ("event");--> statement-breakpoint
CREATE INDEX "admin_actions_actor_idx" ON "admin_actions" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "admin_actions_target_idx" ON "admin_actions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "admin_notes_entity_idx" ON "admin_notes" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_pack_prices_pack_cur_bill_reg_uq" ON "app_pack_prices" USING btree ("pack_id","currency","billing","region");--> statement-breakpoint
CREATE INDEX "app_pack_prices_pack_idx" ON "app_pack_prices" USING btree ("pack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "apt_pack_locale_uq" ON "app_pack_translations" USING btree ("pack_id","locale");--> statement-breakpoint
CREATE INDEX "apt_pack_idx" ON "app_pack_translations" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "blob_gc_when_idx" ON "blob_gc" USING btree ("delete_after");--> statement-breakpoint
CREATE INDEX "change_items_cs_idx" ON "change_items" USING btree ("changeset_id");--> statement-breakpoint
CREATE INDEX "change_sets_site_idx" ON "change_sets" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "change_sets_status_idx" ON "change_sets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "edit_jobs_cs_idx" ON "edit_jobs" USING btree ("changeset_id");--> statement-breakpoint
CREATE INDEX "fix_jobs_site_idx" ON "fix_jobs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "fix_jobs_team_idx" ON "fix_jobs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "fix_jobs_status_idx" ON "fix_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "guest_scans_session_idx" ON "guest_scans" USING btree ("guest_session_id");--> statement-breakpoint
CREATE INDEX "guest_scans_host_idx" ON "guest_scans" USING btree ("canonical_host");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_sessions_claim_token_uq" ON "guest_sessions" USING btree ("claim_token");--> statement-breakpoint
CREATE INDEX "guest_sessions_expires_idx" ON "guest_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "guest_sessions_claimable_idx" ON "guest_sessions" USING btree ("is_claimed","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_team_email_uq" ON "invitations" USING btree ("team_id","email");--> statement-breakpoint
CREATE INDEX "pack_runs_site_idx" ON "pack_runs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "pack_runs_pack_idx" ON "pack_runs" USING btree ("pack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pmt_method_locale_uq" ON "payment_method_translations" USING btree ("method_code","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_pack_inclusion_uq" ON "plan_pack_inclusions" USING btree ("plan_id","pack_id");--> statement-breakpoint
CREATE INDEX "plan_pack_plan_idx" ON "plan_pack_inclusions" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_prices_plan_cur_bill_reg_uq" ON "plan_prices" USING btree ("plan_id","currency","billing","region");--> statement-breakpoint
CREATE INDEX "plan_prices_plan_idx" ON "plan_prices" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_translations_plan_locale_uq" ON "plan_translations" USING btree ("plan_id","locale");--> statement-breakpoint
CREATE INDEX "plan_translations_plan_idx" ON "plan_translations" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rpm_region_method_uq" ON "region_payment_methods" USING btree ("region","method_code");--> statement-breakpoint
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
CREATE INDEX "snapshots_site_idx" ON "snapshots" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "supported_locales_enabled_idx" ON "supported_locales" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_user_uq" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "team_subs_team_idx" ON "team_subscriptions" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_event_provider_id_uq" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "webhook_event_type_idx" ON "webhook_events" USING btree ("event_type");

   -- 0) Enable pgcrypto for gen_random_uuid()
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ============================================
-- Seed step 8: Catalog & i18n (idempotent)
-- ============================================
SET search_path TO public;
-- 6) Partial unique indexes:
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_scan_per_site
	ON public.scan_jobs(site_id)
	WHERE status IN ('queued'::job_status,'running'::job_status);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_fix_site_kind
	ON public.fix_jobs(site_id, kind)
	WHERE status IN ('queued'::job_status,'running'::job_status);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_edit_per_cs_partial
	ON public.edit_jobs(changeset_id)
	WHERE status IN ('queued'::job_status,'running'::job_status);

-- 7) FK for sites.last_scan_job_id (avoid TS init cycle):
ALTER TABLE public.sites
	ADD CONSTRAINT sites_last_scan_job_fk
	FOREIGN KEY (last_scan_job_id) REFERENCES public.scan_jobs(id)
	ON DELETE SET NULL;
-- 9) Optional CHECK: token_hash must be 64 hex chars when present
ALTER TABLE public.sites
	ADD CONSTRAINT sites_token_hash_hex
	CHECK (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$');
	
-- 1) Supported locales
INSERT INTO supported_locales (code, name, enabled, is_default) VALUES
  ('en',    'English',                true,  true),
  ('de',    'Deutsch',                true,  false),
  ('fr',    'Français',               true,  false),
  ('es',    'Español',                true,  false),
  ('it',    'Italiano',               true,  false),
  ('pt-BR', 'Português (Brasil)',     true,  false)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    enabled = EXCLUDED.enabled,
    is_default = EXCLUDED.is_default;

-- ensure single default (en)
UPDATE supported_locales SET is_default = (code = 'en');


-- 2) App packs (base catalog with base EUR monthly price)
-- Slugs are the canonical keys; we upsert by slug.
INSERT INTO app_packs (slug, name, description, category, version, is_enabled, price_cents, price_currency, billing)
VALUES
  ('seo',              'SEO Assistant',      'Analyze & optimize metadata, headings, internal links.',       'seo',      '1.0.0', true,  900, 'EUR', 'monthly'),
  ('faq',              'FAQ Builder',        'Generate FAQs with schema.org markup.',                         'content',  '1.0.0', true,  400, 'EUR', 'monthly'),
  ('compliance',       'Compliance Guard',   'Check cookie banner, imprint, privacy, accessibility.',        'compliance','1.0.0', true,  700, 'EUR', 'monthly'),
  ('bg-color',         'Background Styler',  'Suggest accessible color palettes and apply safely.',          'design',   '1.0.0', true,  300, 'EUR', 'monthly'),
  ('performance',      'Performance Turbo',  'Optimize images, lazy loading, caching & Core Web Vitals.',     'seo',      '1.0.0', true,  800, 'EUR', 'monthly'),
  ('a11y',             'Accessibility Pro',  'Audit WCAG issues; fix headings, contrast, ARIA patterns.',     'compliance','1.0.0', true,  600, 'EUR', 'monthly'),
  ('localizer',        'Localizer',          'Translate key pages and hreflang; language switch UX.',        'content',  '1.0.0', true, 1200, 'EUR', 'monthly'),
  ('schema-pro',       'Schema Pro',         'Add rich schema (Article, FAQ, Product) for better SERP.',     'seo',      '1.0.0', true,  500, 'EUR', 'monthly'),
  ('backup-rollback',  'Backup & Rollback',  'Create restore points and roll back changes safely.',           'ops',      '1.0.0', true,  400, 'EUR', 'monthly'),
  ('blog-optimizer',   'Blog Optimizer',     'Refresh internal links, related posts, and titles.',           'content',  '1.0.0', true,  600, 'EUR', 'monthly')
ON CONFLICT (slug) DO UPDATE
SET name           = EXCLUDED.name,
    description    = EXCLUDED.description,
    category       = EXCLUDED.category,
    version        = EXCLUDED.version,
    is_enabled     = EXCLUDED.is_enabled,
    price_cents    = EXCLUDED.price_cents,
    price_currency = EXCLUDED.price_currency,
    billing        = EXCLUDED.billing,
    updated_at     = now();

-- Optional currency overrides for packs (USD/BRL), region-agnostic (region NULL)
-- One example for each; copy pattern if you want more granular regional prices later.
-- SEO Assistant
INSERT INTO app_pack_prices (pack_id, currency, billing, amount_cents, region)
SELECT id, 'USD', 'monthly', 900, NULL FROM app_packs WHERE slug='seo'
ON CONFLICT (pack_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;
INSERT INTO app_pack_prices (pack_id, currency, billing, amount_cents, region)
SELECT id, 'BRL', 'monthly', 5400, NULL FROM app_packs WHERE slug='seo'
ON CONFLICT (pack_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

-- Repeat a few key ones for illustration (adjust as needed)
-- Localizer
INSERT INTO app_pack_prices (pack_id, currency, billing, amount_cents, region)
SELECT id, 'USD', 'monthly', 1200, NULL FROM app_packs WHERE slug='localizer'
ON CONFLICT (pack_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;
INSERT INTO app_pack_prices (pack_id, currency, billing, amount_cents, region)
SELECT id, 'BRL', 'monthly', 7200, NULL FROM app_packs WHERE slug='localizer'
ON CONFLICT (pack_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

-- Compliance Guard
INSERT INTO app_pack_prices (pack_id, currency, billing, amount_cents, region)
SELECT id, 'USD', 'monthly', 700, NULL FROM app_packs WHERE slug='compliance'
ON CONFLICT (pack_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;
INSERT INTO app_pack_prices (pack_id, currency, billing, amount_cents, region)
SELECT id, 'BRL', 'monthly', 4200, NULL FROM app_packs WHERE slug='compliance'
ON CONFLICT (pack_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

-- 3) Plans (base EN names; translate via plan_translations as you expand)
INSERT INTO plans (slug, name, description, is_active)
VALUES
  ('starter',  'Starter',  'Perfect for small sites and quick wins.',      true),
  ('pro',      'Pro',      'For growing sites that need automation.',      true),
  ('business', 'Business', 'Teams & sites at scale with controls.',        true)
ON CONFLICT (slug) DO UPDATE
SET name        = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active   = EXCLUDED.is_active,
    updated_at  = now();

-- 4) Plan prices (EUR/USD/BRL; yearly has a built-in discount)
-- Use region=NULL for global prices; add per-country rows later if needed.
-- Starter: €19 /mo, €190 /yr
INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'EUR', 'monthly', 1900, NULL FROM plans WHERE slug='starter'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;
INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'EUR', 'yearly', 19000, NULL FROM plans WHERE slug='starter'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'USD', 'monthly', 1900, NULL FROM plans WHERE slug='starter'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;
INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'USD', 'yearly', 19000, NULL FROM plans WHERE slug='starter'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'BRL', 'monthly', 9900, NULL FROM plans WHERE slug='starter'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;
INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'BRL', 'yearly', 99000, NULL FROM plans WHERE slug='starter'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

-- Pro: €49 /mo, €490 /yr
INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'EUR', 'monthly', 4900, NULL FROM plans WHERE slug='pro'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;
INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'EUR', 'yearly', 49000, NULL FROM plans WHERE slug='pro'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'USD', 'monthly', 4900, NULL FROM plans WHERE slug='pro'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;
INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'USD', 'yearly', 49000, NULL FROM plans WHERE slug='pro'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'BRL', 'monthly', 24900, NULL FROM plans WHERE slug='pro'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;
INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'BRL', 'yearly', 249000, NULL FROM plans WHERE slug='pro'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

-- Business: €99 /mo, €990 /yr
INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'EUR', 'monthly', 9900, NULL FROM plans WHERE slug='business'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;
INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'EUR', 'yearly', 99000, NULL FROM plans WHERE slug='business'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'USD', 'monthly', 9900, NULL FROM plans WHERE slug='business'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;
INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'USD', 'yearly', 99000, NULL FROM plans WHERE slug='business'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'BRL', 'monthly', 49900, NULL FROM plans WHERE slug='business'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;
INSERT INTO plan_prices (plan_id, currency, billing, amount_cents, region)
SELECT id, 'BRL', 'yearly', 499000, NULL FROM plans WHERE slug='business'
ON CONFLICT (plan_id, currency, billing, region) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;


-- 5) Plan inclusions (which packs are included by plan)
-- Starter includes: seo, compliance, faq
INSERT INTO plan_pack_inclusions (plan_id, pack_id, included)
SELECT p.id, a.id, true
FROM plans p, app_packs a
WHERE p.slug='starter' AND a.slug IN ('seo','compliance','faq')
ON CONFLICT (plan_id, pack_id) DO UPDATE SET included = EXCLUDED.included;

-- Pro adds: performance, a11y, schema-pro
INSERT INTO plan_pack_inclusions (plan_id, pack_id, included)
SELECT p.id, a.id, true
FROM plans p, app_packs a
WHERE p.slug='pro' AND a.slug IN ('seo','compliance','faq','performance','a11y','schema-pro')
ON CONFLICT (plan_id, pack_id) DO UPDATE SET included = EXCLUDED.included;

-- Business adds: localizer, backup-rollback, blog-optimizer, bg-color
INSERT INTO plan_pack_inclusions (plan_id, pack_id, included)
SELECT p.id, a.id, true
FROM plans p, app_packs a
WHERE p.slug='business' AND a.slug IN ('seo','compliance','faq','performance','a11y','schema-pro','localizer','backup-rollback','blog-optimizer','bg-color')
ON CONFLICT (plan_id, pack_id) DO UPDATE SET included = EXCLUDED.included;
-- ============================================
-- Payment methods + region mapping + tax policy (idempotent)
-- ============================================
SET search_path TO public;

-- 1) Payment methods catalog
INSERT INTO payment_methods (code, provider, category, is_enabled, icon_hint)
VALUES
  ('card','stripe','card',true,'card'),
  ('apple_pay','stripe','wallet',true,'apple'),
  ('google_pay','stripe','wallet',true,'gpay'),
  ('sepa_debit','stripe','bank',true,'sepa'),
  ('ach_debit','stripe','bank',true,'ach'),
  ('sofort','stripe','bank',true,'sofort'),
  ('giropay','stripe','bank',true,'giropay'),
  ('bancontact','stripe','bank',true,'bancontact'),
  ('pix','stripe','bank',true,'pix'),
  ('boleto','stripe','bank',true,'boleto')
ON CONFLICT (code) DO UPDATE
SET provider=EXCLUDED.provider,
    category=EXCLUDED.category,
    is_enabled=EXCLUDED.is_enabled,
    icon_hint=EXCLUDED.icon_hint,
    updated_at=now();

-- 2) Translations (en, de, fr, es, it, pt-BR)
-- EN
INSERT INTO payment_method_translations (method_code, locale, name) VALUES
  ('card','en','Credit/Debit Card'),
  ('apple_pay','en','Apple Pay'),
  ('google_pay','en','Google Pay'),
  ('sepa_debit','en','SEPA Direct Debit'),
  ('ach_debit','en','US Bank Debit (ACH)'),
  ('sofort','en','Sofort'),
  ('giropay','en','Giropay'),
  ('bancontact','en','Bancontact'),
  ('pix','en','Pix'),
  ('boleto','en','Boleto')
ON CONFLICT (method_code, locale) DO UPDATE SET name=EXCLUDED.name;

-- DE
INSERT INTO payment_method_translations (method_code, locale, name) VALUES
  ('card','de','Kredit-/Debitkarte'),
  ('apple_pay','de','Apple Pay'),
  ('google_pay','de','Google Pay'),
  ('sepa_debit','de','SEPA-Lastschrift'),
  ('ach_debit','de','US-Bankeinzug (ACH)'),
  ('sofort','de','Sofort'),
  ('giropay','de','Giropay'),
  ('bancontact','de','Bancontact'),
  ('pix','de','Pix'),
  ('boleto','de','Boleto')
ON CONFLICT (method_code, locale) DO UPDATE SET name=EXCLUDED.name;

-- FR
INSERT INTO payment_method_translations (method_code, locale, name) VALUES
  ('card','fr','Carte bancaire'),
  ('apple_pay','fr','Apple Pay'),
  ('google_pay','fr','Google Pay'),
  ('sepa_debit','fr','Prélèvement SEPA'),
  ('ach_debit','fr','Prélèvement bancaire US (ACH)'),
  ('sofort','fr','Sofort'),
  ('giropay','fr','Giropay'),
  ('bancontact','fr','Bancontact'),
  ('pix','fr','Pix'),
  ('boleto','fr','Boleto')
ON CONFLICT (method_code, locale) DO UPDATE SET name=EXCLUDED.name;

-- ES
INSERT INTO payment_method_translations (method_code, locale, name) VALUES
  ('card','es','Tarjeta de crédito/débito'),
  ('apple_pay','es','Apple Pay'),
  ('google_pay','es','Google Pay'),
  ('sepa_debit','es','Domiciliación SEPA'),
  ('ach_debit','es','Débito bancario US (ACH)'),
  ('sofort','es','Sofort'),
  ('giropay','es','Giropay'),
  ('bancontact','es','Bancontact'),
  ('pix','es','Pix'),
  ('boleto','es','Boleto')
ON CONFLICT (method_code, locale) DO UPDATE SET name=EXCLUDED.name;

-- IT
INSERT INTO payment_method_translations (method_code, locale, name) VALUES
  ('card','it','Carta di credito/debito'),
  ('apple_pay','it','Apple Pay'),
  ('google_pay','it','Google Pay'),
  ('sepa_debit','it','Addebito diretto SEPA'),
  ('ach_debit','it','Addebito bancario US (ACH)'),
  ('sofort','it','Sofort'),
  ('giropay','it','Giropay'),
  ('bancontact','it','Bancontact'),
  ('pix','it','Pix'),
  ('boleto','it','Boleto')
ON CONFLICT (method_code, locale) DO UPDATE SET name=EXCLUDED.name;

-- PT-BR
INSERT INTO payment_method_translations (method_code, locale, name) VALUES
  ('card','pt-BR','Cartão de crédito/débito'),
  ('apple_pay','pt-BR','Apple Pay'),
  ('google_pay','pt-BR','Google Pay'),
  ('sepa_debit','pt-BR','Débito direto SEPA'),
  ('ach_debit','pt-BR','Débito bancário (ACH)'),
  ('sofort','pt-BR','Sofort'),
  ('giropay','pt-BR','Giropay'),
  ('bancontact','pt-BR','Bancontact'),
  ('pix','pt-BR','Pix'),
  ('boleto','pt-BR','Boleto')
ON CONFLICT (method_code, locale) DO UPDATE SET name=EXCLUDED.name;

-- 3) Region → payment methods (display order via priority; smaller = earlier)
-- Germany
INSERT INTO region_payment_methods (region, method_code, enabled, priority) VALUES
  ('DE','card',true,10), ('DE','apple_pay',true,20), ('DE','google_pay',true,30),
  ('DE','sepa_debit',true,40), ('DE','sofort',true,50), ('DE','giropay',true,60)
ON CONFLICT (region, method_code) DO UPDATE SET enabled=EXCLUDED.enabled, priority=EXCLUDED.priority;

-- France
INSERT INTO region_payment_methods (region, method_code, enabled, priority) VALUES
  ('FR','card',true,10), ('FR','apple_pay',true,20), ('FR','google_pay',true,30),
  ('FR','sepa_debit',true,40)
ON CONFLICT (region, method_code) DO UPDATE SET enabled=EXCLUDED.enabled, priority=EXCLUDED.priority;

-- Spain
INSERT INTO region_payment_methods (region, method_code, enabled, priority) VALUES
  ('ES','card',true,10), ('ES','apple_pay',true,20), ('ES','google_pay',true,30),
  ('ES','sepa_debit',true,40)
ON CONFLICT (region, method_code) DO UPDATE SET enabled=EXCLUDED.enabled, priority=EXCLUDED.priority;

-- Italy
INSERT INTO region_payment_methods (region, method_code, enabled, priority) VALUES
  ('IT','card',true,10), ('IT','apple_pay',true,20), ('IT','google_pay',true,30),
  ('IT','sepa_debit',true,40)
ON CONFLICT (region, method_code) DO UPDATE SET enabled=EXCLUDED.enabled, priority=EXCLUDED.priority;

-- Portugal
INSERT INTO region_payment_methods (region, method_code, enabled, priority) VALUES
  ('PT','card',true,10), ('PT','apple_pay',true,20), ('PT','google_pay',true,30),
  ('PT','sepa_debit',true,40)
ON CONFLICT (region, method_code) DO UPDATE SET enabled=EXCLUDED.enabled, priority=EXCLUDED.priority;

-- United States
INSERT INTO region_payment_methods (region, method_code, enabled, priority) VALUES
  ('US','card',true,10), ('US','apple_pay',true,20), ('US','google_pay',true,30),
  ('US','ach_debit',true,40)
ON CONFLICT (region, method_code) DO UPDATE SET enabled=EXCLUDED.enabled, priority=EXCLUDED.priority;

-- Brazil
INSERT INTO region_payment_methods (region, method_code, enabled, priority) VALUES
  ('BR','card',true,10), ('BR','pix',true,20), ('BR','boleto',true,30)
ON CONFLICT (region, method_code) DO UPDATE SET enabled=EXCLUDED.enabled, priority=EXCLUDED.priority;

-- Australia
INSERT INTO region_payment_methods (region, method_code, enabled, priority) VALUES
  ('AU','card',true,10), ('AU','apple_pay',true,20), ('AU','google_pay',true,30)
ON CONFLICT (region, method_code) DO UPDATE SET enabled=EXCLUDED.enabled, priority=EXCLUDED.priority;

-- New Zealand
INSERT INTO region_payment_methods (region, method_code, enabled, priority) VALUES
  ('NZ','card',true,10), ('NZ','apple_pay',true,20), ('NZ','google_pay',true,30)
ON CONFLICT (region, method_code) DO UPDATE SET enabled=EXCLUDED.enabled, priority=EXCLUDED.priority;


-- 4) Tax display policies (UI hints only; Stripe Tax does the math)
-- EU (sample core markets): VAT included + reverse charge eligible
INSERT INTO tax_display_policies (country, tax_label, collect_vat_id, collect_national_id, reverse_charge_eligible, note)
VALUES
  ('DE','vat_included',true,false,true,'Prices include VAT. Enter a valid VAT ID for reverse charge (B2B).'),
  ('FR','vat_included',true,false,true,'Prices include VAT. Enter VAT number for reverse charge (B2B).'),
  ('ES','vat_included',true,false,true,'Prices include VAT. Enter VAT number for reverse charge (B2B).'),
  ('IT','vat_included',true,false,true,'Prices include VAT. Enter VAT number for reverse charge (B2B).'),
  ('PT','vat_included',true,false,true,'Prices include VAT. Enter VAT number for reverse charge (B2B).')
ON CONFLICT (country) DO UPDATE
SET tax_label = EXCLUDED.tax_label,
    collect_vat_id = EXCLUDED.collect_vat_id,
    collect_national_id = EXCLUDED.collect_national_id,
    reverse_charge_eligible = EXCLUDED.reverse_charge_eligible,
    note = EXCLUDED.note,
    updated_at = now();

-- US: tax added at checkout
INSERT INTO tax_display_policies (country, tax_label, collect_vat_id, collect_national_id, reverse_charge_eligible, note)
VALUES ('US','tax_added',false,false,false,'Sales tax calculated at checkout.')
ON CONFLICT (country) DO UPDATE
SET tax_label = EXCLUDED.tax_label,
    collect_vat_id = EXCLUDED.collect_vat_id,
    collect_national_id = EXCLUDED.collect_national_id,
    reverse_charge_eligible = EXCLUDED.reverse_charge_eligible,
    note = EXCLUDED.note,
    updated_at = now();

-- Brazil: collect CPF/CNPJ; taxes added
INSERT INTO tax_display_policies (country, tax_label, collect_vat_id, collect_national_id, reverse_charge_eligible, note)
VALUES ('BR','tax_added',false,true,false,'Impostos calculados no checkout. Informe CPF/CNPJ.')
ON CONFLICT (country) DO UPDATE
SET tax_label = EXCLUDED.tax_label,
    collect_vat_id = EXCLUDED.collect_vat_id,
    collect_national_id = EXCLUDED.collect_national_id,
    reverse_charge_eligible = EXCLUDED.reverse_charge_eligible,
    note = EXCLUDED.note,
    updated_at = now();

-- AU/NZ: GST added at checkout
INSERT INTO tax_display_policies (country, tax_label, collect_vat_id, collect_national_id, reverse_charge_eligible, note)
VALUES
  ('AU','tax_added',false,false,false,'GST calculated at checkout.'),
  ('NZ','tax_added',false,false,false,'GST calculated at checkout.')
ON CONFLICT (country) DO UPDATE
SET tax_label = EXCLUDED.tax_label,
    note = EXCLUDED.note,
    updated_at = now();
