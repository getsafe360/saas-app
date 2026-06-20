-- Migration: 0008_add_wordpress_agent_tables
-- Adds dedicated persistence for WordPress snapshots, action runs, and verification evidence.

BEGIN;

CREATE TABLE IF NOT EXISTS "wordpress_site_snapshots" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id"           uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
  "source"            text NOT NULL DEFAULT 'connector',
  "builder"           text NOT NULL DEFAULT 'unknown',
  "wordpress_version" text,
  "plugin_version"    text,
  "active_theme"      text,
  "plugin_count"      integer,
  "snapshot"          jsonb NOT NULL,
  "created_at"        timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "wp_snapshots_site_idx"
  ON "wordpress_site_snapshots" ("site_id");
CREATE INDEX IF NOT EXISTS "wp_snapshots_site_created_idx"
  ON "wordpress_site_snapshots" ("site_id", "created_at");

CREATE TABLE IF NOT EXISTS "wordpress_action_runs" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id"           uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
  "change_set_id"     uuid REFERENCES "change_sets"("id") ON DELETE SET NULL,
  "action_id"         text NOT NULL,
  "action_type"       text NOT NULL,
  "title"             text NOT NULL,
  "status"            text NOT NULL,
  "risk"              text,
  "auto_applied"      boolean NOT NULL DEFAULT false,
  "requires_approval" boolean NOT NULL DEFAULT false,
  "input_payload"     jsonb NOT NULL,
  "result_payload"    jsonb,
  "rollback_payload"  jsonb,
  "verification_ok"   boolean,
  "started_at"        timestamp NOT NULL DEFAULT now(),
  "completed_at"      timestamp,
  "created_at"        timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "wp_action_runs_site_idx"
  ON "wordpress_action_runs" ("site_id");
CREATE INDEX IF NOT EXISTS "wp_action_runs_action_id_idx"
  ON "wordpress_action_runs" ("action_id");
CREATE INDEX IF NOT EXISTS "wp_action_runs_changeset_idx"
  ON "wordpress_action_runs" ("change_set_id");

CREATE TABLE IF NOT EXISTS "wordpress_verifications" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "action_run_id"  uuid NOT NULL REFERENCES "wordpress_action_runs"("id") ON DELETE CASCADE,
  "site_id"        uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
  "ok"             boolean NOT NULL DEFAULT false,
  "checks"         jsonb NOT NULL,
  "dom_summary"    text,
  "screenshot_url" text,
  "result_payload" jsonb,
  "created_at"     timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "wp_verifications_action_run_idx"
  ON "wordpress_verifications" ("action_run_id");
CREATE INDEX IF NOT EXISTS "wp_verifications_site_idx"
  ON "wordpress_verifications" ("site_id");

COMMIT;
