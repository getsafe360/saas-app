// lib/db/schema/reports/branding.ts
// White-label branding settings for report generation (Agency plan feature)

import {
  pgTable, uuid, integer, varchar, text, timestamp, jsonb, index
} from 'drizzle-orm/pg-core';
import { teams } from '../auth/teams';

/**
 * Branding color scheme for reports
 */
export interface BrandingColors {
  primary: string;      // e.g., "#2563eb"
  secondary: string;    // e.g., "#1e40af"
  accent: string;       // e.g., "#3b82f6"
  background: string;   // e.g., "#ffffff"
  text: string;         // e.g., "#1f2937"
}

/**
 * Contact information displayed on reports
 */
export interface BrandingContact {
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
}

/**
 * Full branding configuration
 */
export interface BrandingConfig {
  colors: BrandingColors;
  contact: BrandingContact;
  tagline?: string;           // e.g., "Your trusted web optimization partner"
  footerText?: string;        // Custom footer text
  showPoweredBy: boolean;     // Show "Powered by GetSafe 360" (default: true)
}

/**
 * Report Branding Table
 *
 * Stores white-label branding settings per team for PDF/HTML report generation.
 * Only available on Agency plan.
 */
export const reportBranding = pgTable('report_branding', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Team that owns this branding
  teamId: integer('team_id')
    .notNull()
    .unique()
    .references(() => teams.id, { onDelete: 'cascade' }),

  // Company/Agency details
  companyName: varchar('company_name', { length: 200 }).notNull(),
  logoUrl: text('logo_url'),              // URL to uploaded logo
  logoLightUrl: text('logo_light_url'),   // Light version for dark backgrounds

  // Full branding configuration
  config: jsonb('config').$type<BrandingConfig>().notNull().default({
    colors: {
      primary: '#2563eb',
      secondary: '#1e40af',
      accent: '#3b82f6',
      background: '#ffffff',
      text: '#1f2937',
    },
    contact: {},
    showPoweredBy: true,
  }),

  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  teamIdx: index('report_branding_team_idx').on(table.teamId),
}));

// Type exports
export type ReportBranding = typeof reportBranding.$inferSelect;
export type NewReportBranding = typeof reportBranding.$inferInsert;
