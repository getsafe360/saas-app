CREATE TYPE "token_transaction_type" AS ENUM ('purchase', 'auto_replenish', 'bonus', 'admin_adjustment', 'burn');--> statement-breakpoint

ALTER TABLE "teams" ADD COLUMN "tokens_purchased_this_month" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "tokens_purchased_this_month_eur" numeric(10,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "auto_replenish_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "show_low_token_banner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "last_purchased_pack_id" varchar(50);--> statement-breakpoint

CREATE TABLE "token_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" integer NOT NULL,
  "amount_tokens" integer NOT NULL,
  "amount_eur" numeric(10,2),
  "type" "token_transaction_type" NOT NULL,
  "stripe_payment_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
