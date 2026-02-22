-- Migration: Add cockpit_layouts table
CREATE TABLE "cockpit_layouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" integer NOT NULL,
  "site_id" uuid,
  "layout" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  
  CONSTRAINT "cockpit_layouts_user_id_users_id_fk" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "cockpit_layouts_site_id_sites_id_fk" 
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE,
  CONSTRAINT "cockpit_layouts_user_site_uq" 
    UNIQUE ("user_id", "site_id")
);

CREATE INDEX "cockpit_layouts_user_idx" ON "cockpit_layouts" ("user_id");
CREATE INDEX "cockpit_layouts_site_idx" ON "cockpit_layouts" ("site_id");