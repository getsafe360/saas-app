// lib/db/schema/ai/analysis.ts
// AI analysis jobs and repair actions

import {
  pgTable, uuid, integer, text, timestamp, jsonb
} from 'drizzle-orm/pg-core';
import { sites } from '../sites/sites';
import { users } from '../auth/users';

export const aiAnalysisJobs = pgTable('ai_analysis_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  jobId: text('job_id').unique(),
  status: text('status').default('pending'),
  selectedModules: jsonb('selected_modules'),
  results: jsonb('results'),
  issuesFound: integer('issues_found'),
  repairableIssues: integer('repairable_issues'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const aiRepairActions = pgTable('ai_repair_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  analysisJobId: uuid('analysis_job_id').references(() => aiAnalysisJobs.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }),
  issueId: text('issue_id'),
  category: text('category'),
  status: text('status').default('pending'),
  repairMethod: text('repair_method'),
  changes: jsonb('changes'),
  errorMessage: text('error_message'),
  executedAt: timestamp('executed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Type exports
export type AiAnalysisJob = typeof aiAnalysisJobs.$inferSelect;
export type NewAiAnalysisJob = typeof aiAnalysisJobs.$inferInsert;
export type AiRepairAction = typeof aiRepairActions.$inferSelect;
export type NewAiRepairAction = typeof aiRepairActions.$inferInsert;
