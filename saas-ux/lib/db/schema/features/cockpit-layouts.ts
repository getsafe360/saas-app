// lib/db/schema/cockpit-layouts.ts
// Add this to your existing schema file or import into schema/index.ts

import { pgTable, uuid, integer, jsonb, timestamp, varchar, boolean, index, unique } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { sites } from '../sites/sites';

/**
 * Cockpit Layout Types - used in both schema and components
 */
export interface CockpitCardLayout {
  id: string;
  visible: boolean;
  minimized: boolean;
  order: number;
}

export interface CockpitLayoutData {
  version: number; // For future migrations
  cards: CockpitCardLayout[];
  theme?: string;
  customCards?: CockpitCardLayout[]; // Future: user-created cards
}

/**
 * User Cockpit Layouts Table
 * 
 * Stores per-user, per-site dashboard card layouts.
 * Falls back to user defaults, then system defaults.
 */
export const cockpitLayouts = pgTable('cockpit_layouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // User who owns this layout
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  // Optional: site-specific layout (null = user's default layout)
  siteId: uuid('site_id')
    .references(() => sites.id, { onDelete: 'cascade' }),
  
  // Layout data as JSONB
  layout: jsonb('layout').$type<CockpitLayoutData>().notNull(),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index for fast lookups
  userIdx: index('cockpit_layouts_user_idx').on(table.userId),
  siteIdx: index('cockpit_layouts_site_idx').on(table.siteId),
  
  // Unique constraint: one layout per user+site combination
  // null siteId = user's default layout
  userSiteUnique: unique('cockpit_layouts_user_site_uq').on(table.userId, table.siteId),
}));

// Type exports for TypeScript
export type CockpitLayout = typeof cockpitLayouts.$inferSelect;
export type NewCockpitLayout = typeof cockpitLayouts.$inferInsert;


// ============================================
// SQL Migration (run this in your migration)
// ============================================
/*

-- Example default layout:
-- {
--   "version": 1,
--   "cards": [
--     {"id": "quick-wins", "visible": true, "minimized": false, "order": 0},
--     {"id": "performance", "visible": true, "minimized": false, "order": 1},
--     {"id": "security", "visible": true, "minimized": false, "order": 2},
--     {"id": "seo", "visible": true, "minimized": false, "order": 3},
--     {"id": "accessibility", "visible": true, "minimized": false, "order": 4},
--     {"id": "wordpress", "visible": true, "minimized": false, "order": 5},
--     {"id": "technology", "visible": true, "minimized": false, "order": 6},
--     {"id": "mobile", "visible": true, "minimized": false, "order": 7},
--     {"id": "network", "visible": true, "minimized": false, "order": 8}
--   ]
-- }
*/
