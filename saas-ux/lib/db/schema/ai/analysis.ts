// lib/db/schema/ai/analysis.ts
// AI analysis jobs and repair actions

import {
  pgTable, uuid, integer, text, timestamp, jsonb, index
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
  results: jsonb('results'),
  issuesFound: integer('issues_found'),
  repairableIssues: integer('repairable_issues'),
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
  category: text('category'),
  status: aiRepairStatusEnum('status').notNull().default('pending'),
  repairMethod: text('repair_method'),
  changes: jsonb('changes'),
  errorMessage: text('error_message'),
  executedAt: timestamp('executed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  byAnalysisJob: index('ai_repair_actions_analysis_job_idx').on(t.analysisJobId),
  bySite: index('ai_repair_actions_site_idx').on(t.siteId),
  byStatus: index('ai_repair_actions_status_idx').on(t.status),
}));

// Type exports
export type AiAnalysisJob = typeof aiAnalysisJobs.$inferSelect;
export type NewAiAnalysisJob = typeof aiAnalysisJobs.$inferInsert;
export type AiRepairAction = typeof aiRepairActions.$inferSelect;
export type NewAiRepairAction = typeof aiRepairActions.$inferInsert;
