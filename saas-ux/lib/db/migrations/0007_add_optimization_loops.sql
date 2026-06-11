-- Migration: 0007_add_optimization_loops
-- Adds autonomous optimization loop tables

DO $$ BEGIN
  CREATE TYPE "loop_status" AS ENUM (
    'queued','running','analyzing','planning_fix','awaiting_approval',
    'applying_fix','verifying','rescoring','completed','stopped','failed','rolled_back'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "loop_stop_reason" AS ENUM (
    'goal_reached','max_iterations_reached','no_safe_fixes_available',
    'score_regressed','verification_failed','connector_unavailable',
    'user_cancelled','budget_limit_reached','manual_review_required'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "optimization_mode" AS ENUM (
    'report_only','approval_required','safe_auto'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "iteration_status" AS ENUM (
    'pending','applying','verifying','completed','failed','skipped','rolled_back'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "optimization_loops" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id"           uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
  "category"          text NOT NULL,
  "mode"              "optimization_mode" NOT NULL DEFAULT 'safe_auto',
  "status"            "loop_status" NOT NULL DEFAULT 'queued',
  "goal_score"        integer NOT NULL,
  "starting_score"    integer,
  "current_score"     integer,
  "max_iterations"    integer NOT NULL DEFAULT 5,
  "current_iteration" integer NOT NULL DEFAULT 0,
  "stop_reason"       "loop_stop_reason",
  "site_snapshot"     jsonb,
  "created_at"        timestamp NOT NULL DEFAULT now(),
  "updated_at"        timestamp NOT NULL DEFAULT now(),
  "completed_at"      timestamp
);

CREATE TABLE IF NOT EXISTS "optimization_loop_iterations" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "loop_id"             uuid NOT NULL REFERENCES "optimization_loops"("id") ON DELETE CASCADE,
  "iteration_number"    integer NOT NULL,
  "issue_id"            text,
  "issue_title"         text NOT NULL,
  "issue_severity"      text NOT NULL,
  "fix_type"            text NOT NULL,
  "fix_payload"         jsonb NOT NULL,
  "score_before"        integer NOT NULL,
  "score_after"         integer,
  "status"              "iteration_status" NOT NULL DEFAULT 'pending',
  "verification_result" jsonb,
  "error_message"       text,
  "created_at"          timestamp NOT NULL DEFAULT now(),
  "completed_at"        timestamp
);

CREATE TABLE IF NOT EXISTS "applied_fixes" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id"            uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
  "loop_id"            uuid REFERENCES "optimization_loops"("id") ON DELETE SET NULL,
  "iteration_id"       uuid REFERENCES "optimization_loop_iterations"("id") ON DELETE SET NULL,
  "category"           text NOT NULL,
  "fix_type"           text NOT NULL,
  "fix_id"             text NOT NULL,
  "target"             text NOT NULL,
  "payload"            jsonb NOT NULL,
  "connector_response" jsonb,
  "status"             text NOT NULL DEFAULT 'applied',
  "rollback_payload"   jsonb,
  "created_at"         timestamp NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "opt_loops_site_idx"       ON "optimization_loops" ("site_id");
CREATE INDEX IF NOT EXISTS "opt_loops_status_idx"     ON "optimization_loops" ("status");
CREATE INDEX IF NOT EXISTS "opt_loops_site_cat_idx"   ON "optimization_loops" ("site_id", "category");
CREATE INDEX IF NOT EXISTS "opt_loop_iter_loop_idx"   ON "optimization_loop_iterations" ("loop_id");
CREATE INDEX IF NOT EXISTS "applied_fixes_site_idx"   ON "applied_fixes" ("site_id");
CREATE INDEX IF NOT EXISTS "applied_fixes_loop_idx"   ON "applied_fixes" ("loop_id");
CREATE INDEX IF NOT EXISTS "applied_fixes_fix_id_idx" ON "applied_fixes" ("fix_id");
