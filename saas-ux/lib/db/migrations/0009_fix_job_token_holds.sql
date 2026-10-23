-- 0009_fix_job_token_holds.sql
--
-- Adds the approval gate and token-hold bookkeeping to fix_jobs.
--
-- Before this, /api/fix/start deducted tokens immediately and /api/fix/accept
-- deducted them a second time, while /api/fix/cancel refunded nothing. Tokens
-- are now *held* at start and only moved on a successful apply.
--
-- Safe to re-run. The 'legacy' marking of pre-existing rows happens ONLY in the
-- run that first adds approval_state. (The original statement matched every row
-- on every run, so a re-run would have converted real pending fix jobs to
-- 'legacy' and silently dropped their token holds.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fix_jobs' AND column_name = 'approval_state'
  ) THEN
    ALTER TABLE "fix_jobs" ADD COLUMN IF NOT EXISTS "hold_tokens" integer NOT NULL DEFAULT 0;
    ALTER TABLE "fix_jobs" ADD COLUMN IF NOT EXISTS "approval_state" varchar(24) NOT NULL DEFAULT 'pending';
    ALTER TABLE "fix_jobs" ADD COLUMN IF NOT EXISTS "proposal_blob_key" varchar(256);
    -- rows that predate the hold model are terminal: they never count against a team's balance
    UPDATE "fix_jobs" SET "approval_state" = 'legacy';
  END IF;
END $$;
--> statement-breakpoint
-- If only some columns were added by hand earlier, add the rest without touching data.
ALTER TABLE "fix_jobs" ADD COLUMN IF NOT EXISTS "hold_tokens" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "fix_jobs" ADD COLUMN IF NOT EXISTS "approval_state" varchar(24) NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE "fix_jobs" ADD COLUMN IF NOT EXISTS "proposal_blob_key" varchar(256);
--> statement-breakpoint
-- Used by the available-token calculation on every fix start.
CREATE INDEX IF NOT EXISTS "fix_jobs_team_approval_idx" ON "fix_jobs" ("team_id", "approval_state");
