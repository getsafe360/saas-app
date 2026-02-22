ALTER TABLE "ai_analysis_jobs" ADD COLUMN "locale" text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "ai_analysis_jobs" ADD COLUMN "analysis_depth" text DEFAULT 'balanced';--> statement-breakpoint
ALTER TABLE "ai_analysis_jobs" ADD COLUMN "safe_mode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_repair_actions" ADD COLUMN "action_id" text;--> statement-breakpoint
ALTER TABLE "ai_repair_actions" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "ai_repair_actions" ADD COLUMN "severity" text;--> statement-breakpoint
ALTER TABLE "ai_repair_actions" ADD COLUMN "safe_mode_skipped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_repair_actions" ADD COLUMN "report_included" boolean DEFAULT true NOT NULL;