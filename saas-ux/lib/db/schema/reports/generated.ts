// lib/db/schema/reports/generated.ts
// Generated reports history and storage

import {
  pgTable, uuid, integer, varchar, text, timestamp, jsonb, index, pgEnum
} from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { sites } from '../sites/sites';
import { teams } from '../auth/teams';

/**
 * Report format enum
 */
export const reportFormatEnum = pgEnum('report_format', [
  'pdf', 'csv', 'html'
]);

/**
 * Report scope enum - what categories are included
 */
export const reportScopeEnum = pgEnum('report_scope', [
  'full',           // All categories
  'performance',    // Performance optimization only
  'security',       // Security audit only
  'seo',           // SEO analysis only
  'accessibility', // Accessibility check only
  'custom'         // Custom selection of categories
]);

/**
 * Report status enum
 */
export const reportStatusEnum = pgEnum('report_status', [
  'pending',     // Queued for generation
  'generating',  // Currently being generated
  'completed',   // Successfully generated
  'failed'       // Generation failed
]);

/**
 * Metadata about report contents
 */
export interface ReportMetadata {
  // Overall scores
  overallScore?: number;
  overallGrade?: string;

  // Category scores (if included)
  categoryScores?: {
    performance?: number;
    security?: number;
    seo?: number;
    accessibility?: number;
  };

  // Optimization summary
  issuesFound?: number;
  issuesFixed?: number;

  // Savings summary
  estimatedSavings?: {
    loadTime?: string;      // e.g., "2.4s"
    bandwidth?: string;     // e.g., "847KB"
    monthlyCost?: string;   // e.g., "$47"
  };

  // Performance scorecard (100-point system)
  scorecardTotal?: number;
  scorecardBreakdown?: {
    coreWebVitals: number;      // A: 20 pts
    images: number;             // B: 14 pts
    css: number;                // C: 10 pts
    javascript: number;         // D: 14 pts
    fonts: number;              // E: 8 pts
    networkCompression: number; // F: 10 pts
    caching: number;            // G: 8 pts
    serverTTFB: number;         // H: 8 pts
    thirdParty: number;         // I: 8 pts
    domRendering: number;       // J: 6 pts
  };

  // Custom categories included (for scope='custom')
  includedCategories?: string[];

  // Generation details
  generationTimeMs?: number;
  pageCount?: number;
}

/**
 * Generated Reports Table
 *
 * Tracks all generated reports with their storage locations and metadata.
 */
export const generatedReports = pgTable('generated_reports', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Ownership
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),

  // Report configuration
  format: reportFormatEnum('format').notNull(),
  scope: reportScopeEnum('scope').notNull().default('full'),
  status: reportStatusEnum('status').notNull().default('pending'),

  // Report naming
  title: varchar('title', { length: 300 }),           // Custom title or auto-generated
  filename: varchar('filename', { length: 255 }),     // Generated filename

  // Storage (Vercel Blob)
  blobUrl: text('blob_url'),                          // Public download URL
  blobKey: varchar('blob_key', { length: 500 }),      // Storage key for deletion

  // Content metadata
  metadata: jsonb('metadata').$type<ReportMetadata>(),

  // Error tracking
  errorMessage: text('error_message'),

  // White-label branding applied (references report_branding)
  brandingApplied: jsonb('branding_applied'),         // Snapshot of branding at generation time

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  generatedAt: timestamp('generated_at'),             // When generation completed
  expiresAt: timestamp('expires_at'),                 // Optional expiration for auto-cleanup
}, (table) => ({
  teamIdx: index('generated_reports_team_idx').on(table.teamId),
  userIdx: index('generated_reports_user_idx').on(table.userId),
  siteIdx: index('generated_reports_site_idx').on(table.siteId),
  statusIdx: index('generated_reports_status_idx').on(table.status),
  createdIdx: index('generated_reports_created_idx').on(table.createdAt),
}));

// Type exports
export type GeneratedReport = typeof generatedReports.$inferSelect;
export type NewGeneratedReport = typeof generatedReports.$inferInsert;
export type ReportFormat = 'pdf' | 'csv' | 'html';
export type ReportScope = 'full' | 'performance' | 'security' | 'seo' | 'accessibility' | 'custom';
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';
