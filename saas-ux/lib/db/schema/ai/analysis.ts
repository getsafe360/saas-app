// lib/db/schema/ai/analysis.ts
// AI analysis jobs and repair actions

import {
  pgTable, uuid, integer, text, timestamp, jsonb, index, boolean
} from 'drizzle-orm/pg-core';
import { aiJobStatusEnum, aiRepairStatusEnum } from '../_shared/enums';
import { sites } from '../sites/sites';
import { users } from '../auth/users';

export const aiAnalysisJobs = pgTable('ai_analysis_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  jobId: text('job_id').unique(),
  status: aiJobStatusEnum('status').notNull().default('pending'),
  selectedModules: jsonb('selected_modules'),
  locale: text('locale').default('en'),
  analysisDepth: text('analysis_depth').default('balanced'),
  safeMode: boolean('safe_mode').notNull().default(true),
  results: jsonb('results'),
  issuesFound: integer('issues_found'),
  repairableIssues: integer('repairable_issues'),
  // Token accounting
  tokensUsed: integer('tokens_used'),
  provider: text('provider'),       // 'anthropic' | 'openai' | 'google'
  modelId: text('model_id'),        // 'claude-opus-4-7' | 'gpt-4o-mini' etc.
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  bySite: index('ai_analysis_jobs_site_idx').on(t.siteId),
  byStatus: index('ai_analysis_jobs_status_idx').on(t.status),
  byJobId: index('ai_analysis_jobs_job_id_idx').on(t.jobId),
}));

export const aiRepairActions = pgTable('ai_repair_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  analysisJobId: uuid('analysis_job_id').references(() => aiAnalysisJobs.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }),
  issueId: text('issue_id'),
  // Section grouping for SEO-GEO audit (8 card categories)
  // 'technical-seo' | 'content-eeat' | 'ai-seo' | 'geo' | 'aeo' | 'author-seo' | 'ai-analytics' | 'llms-txt'
  seoSection: text('seo_section'),
  category: text('category'),
  actionId: text('action_id'),
  title: text('title'),
  severity: text('severity'),       // 'low' | 'medium' | 'high' | 'critical'
  score: integer('score'),          // 0–5 per finding (matches AI-SEO-GEO strategy)
  // Human-readable impact explanation (2-3 sentences)
  impact: text('impact'),
  // Actionable fix details: { type, description, snippet?, effort }
  automatedFix: jsonb('automated_fix'),
  status: aiRepairStatusEnum('status').notNull().default('pending'),
  repairMethod: text('repair_method'),
  changes: jsonb('changes'),
  errorMessage: text('error_message'),
  // Token accounting per action
  tokensUsed: integer('tokens_used'),
  provider: text('provider'),
  modelId: text('model_id'),
  // Queue management
  addedToRepairQueue: boolean('added_to_repair_queue').notNull().default(false),
  executedAt: timestamp('executed_at'),
  safeModeSkipped: boolean('safe_mode_skipped').notNull().default(false),
  reportIncluded: boolean('report_included').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  byAnalysisJob: index('ai_repair_actions_analysis_job_idx').on(t.analysisJobId),
  bySite: index('ai_repair_actions_site_idx').on(t.siteId),
  byStatus: index('ai_repair_actions_status_idx').on(t.status),
  bySection: index('ai_repair_actions_section_idx').on(t.seoSection),
}));

// Type exports
export type AiAnalysisJob = typeof aiAnalysisJobs.$inferSelect;
export type NewAiAnalysisJob = typeof aiAnalysisJobs.$inferInsert;
export type AiRepairAction = typeof aiRepairActions.$inferSelect;
export type NewAiRepairAction = typeof aiRepairActions.$inferInsert;

// SEO-GEO section card types (8 cards matching the strategy)
export type SeoSection =
  | 'technical-seo'   // Technical SEO + On-Page + Internal Links + Mobile + Page Experience
  | 'content-eeat'    // Content Quality, E-E-A-T + Structured Data
  | 'ai-seo'          // AI Search Optimization (summarizability, entity clarity, etc.)
  | 'geo'             // Generative Engine Optimization
  | 'aeo'             // Answer Engine Optimization
  | 'author-seo'      // Author identity, credibility, E-E-A-T for AI
  | 'ai-analytics'    // AI Search Analytics + AI Citation Rate
  | 'llms-txt';       // llms.txt presence, permissions, versioning

export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AutomatedFix {
  type: 'code' | 'config' | 'content' | 'manual';
  description: string;
  snippet?: string;
  effort: 'low' | 'medium' | 'high';
}

// Structured finding shape returned by the AI stream
export interface SeoFinding {
  id: string;
  section: SeoSection;
  title: string;
  severity: FindingSeverity;
  score: number;         // 0–5
  impact: string;
  automatedFix: AutomatedFix;
  tokensUsed?: number;
}

// Section sub-scores for the master score gauge
export interface SeoMasterScore {
  technicalSeo: number;   // 0–100
  aiSeo: number;          // 0–30 (6 × 5)
  geo: number;            // 0–30
  aeo: number;            // 0–25
  authorSeo: number;      // 0–25
  aiAnalytics: number;    // 0–25
  aiCitation: number;     // 0–25
  llmsTxt: number;        // 0–25
  master: number;         // normalized 0–100
  totalTokensUsed: number;
  modelId: string;
  provider: string;
}
