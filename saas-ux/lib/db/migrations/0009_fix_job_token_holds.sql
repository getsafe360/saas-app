-- 0009_fix_job_token_holds.sql
--
-- Adds the approval gate and token-hold bookkeeping to fix_jobs.
--
-- Before this, /api/fix/start deducted tokens immediately and /api/fix/accept
-- deducted them a second time, while /api/fix/cancel refunded nothing. Tokens
-- are now *held* at start and only moved on a successful apply.
--
-- All additive. No data loss.

ALTER TABLE "fix_jobs" ADD COLUMN IF NOT EXISTS "hold_tokens" integer NOT NULL DEFAULT 0;
ALTER TABLE "fix_jobs" ADD COLUMN IF NOT EXISTS "approval_state" varchar(24) NOT NULL DEFAULT 'pending';
ALTER TABLE "fix_jobs" ADD COLUMN IF NOT EXISTS "proposal_blob_key" varchar(256);

-- Existing rows predate the hold model; mark them terminal so the "held
-- tokens" sum below never counts historical jobs against a team's balance.
UPDATE "fix_jobs" SET "approval_state" = 'legacy' WHERE "approval_state" = 'pending' AND "created_at" < now();

-- Used by the available-token calculation on every fix start.
CREATE INDEX IF NOT EXISTS "fix_jobs_team_approval_idx" ON "fix_jobs" ("team_id", "approval_state");
