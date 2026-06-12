// lib/db/schema/optimization/loops.ts
// Optimization loop tables for the autonomous category loop system

import {
  pgTable, uuid, text, integer, timestamp, jsonb, index, pgEnum
} from 'drizzle-orm/pg-core';
import { sites } from '../sites/sites';

// ── Enums ────────────────────────────────────────────────────────────────────

export const loopStatusEnum = pgEnum('loop_status', [
  'queued',
  'running',
  'analyzing',
  'planning_fix',
  'awaiting_approval',
  'applying_fix',
  'verifying',
  'rescoring',
  'completed',
  'stopped',
  'failed',
  'rolled_back',
]);

export const loopStopReasonEnum = pgEnum('loop_stop_reason', [
  'goal_reached',
  'max_iterations_reached',
  'no_safe_fixes_available',
  'score_regressed',
  'verification_failed',
  'connector_unavailable',
  'user_cancelled',
  'budget_limit_reached',
  'manual_review_required',
]);

export const optimizationModeEnum = pgEnum('optimization_mode', [
  'report_only',
  'approval_required',
  'safe_auto',
]);

export const iterationStatusEnum = pgEnum('iteration_status', [
  'pending',
  'applying',
  'verifying',
  'completed',
  'failed',
  'skipped',
  'rolled_back',
]);

// ── Tables ───────────────────────────────────────────────────────────────────

export const optimizationLoops = pgTable('optimization_loops', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  mode: optimizationModeEnum('mode').notNull().default('safe_auto'),
  status: loopStatusEnum('status').notNull().default('queued'),
  goalScore: integer('goal_score').notNull(),
  startingScore: integer('starting_score'),
  currentScore: integer('current_score'),
  maxIterations: integer('max_iterations').notNull().default(5),
  currentIteration: integer('current_iteration').notNull().default(0),
  stopReason: loopStopReasonEnum('stop_reason'),
  // Snapshot of site facts used throughout the loop
  siteSnapshot: jsonb('site_snapshot'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (t) => ({
  bySite: index('opt_loops_site_idx').on(t.siteId),
  byStatus: index('opt_loops_status_idx').on(t.status),
  bySiteCategory: index('opt_loops_site_cat_idx').on(t.siteId, t.category),
}));

export const optimizationLoopIterations = pgTable('optimization_loop_iterations', {
  id: uuid('id').primaryKey().defaultRandom(),
  loopId: uuid('loop_id').notNull().references(() => optimizationLoops.id, { onDelete: 'cascade' }),
  iterationNumber: integer('iteration_number').notNull(),
  issueId: text('issue_id'),
  issueTitle: text('issue_title').notNull(),
  issueSeverity: text('issue_severity').notNull(),
  fixType: text('fix_type').notNull(),
  fixPayload: jsonb('fix_payload').notNull(),
  scoreBefore: integer('score_before').notNull(),
  scoreAfter: integer('score_after'),
  status: iterationStatusEnum('status').notNull().default('pending'),
  verificationResult: jsonb('verification_result'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (t) => ({
  byLoop: index('opt_loop_iter_loop_idx').on(t.loopId),
}));

export const appliedFixes = pgTable('applied_fixes', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  loopId: uuid('loop_id').references(() => optimizationLoops.id, { onDelete: 'set null' }),
  iterationId: uuid('iteration_id').references(() => optimizationLoopIterations.id, { onDelete: 'set null' }),
  category: text('category').notNull(),
  fixType: text('fix_type').notNull(),
  // The fix ID sent to WordPress (used for future deletion/rollback)
  fixId: text('fix_id').notNull(),
  target: text('target').notNull(),
  payload: jsonb('payload').notNull(),
  connectorResponse: jsonb('connector_response'),
  status: text('status').notNull().default('applied'),
  // What to send to roll this back (e.g. delete the fix by fixId)
  rollbackPayload: jsonb('rollback_payload'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  bySite: index('applied_fixes_site_idx').on(t.siteId),
  byLoop: index('applied_fixes_loop_idx').on(t.loopId),
  byFixId: index('applied_fixes_fix_id_idx').on(t.fixId),
}));

// Type exports
export type OptimizationLoop = typeof optimizationLoops.$inferSelect;
export type NewOptimizationLoop = typeof optimizationLoops.$inferInsert;
export type OptimizationLoopIteration = typeof optimizationLoopIterations.$inferSelect;
export type NewOptimizationLoopIteration = typeof optimizationLoopIterations.$inferInsert;
export type AppliedFix = typeof appliedFixes.$inferSelect;
export type NewAppliedFix = typeof appliedFixes.$inferInsert;

export type LoopStatus = typeof loopStatusEnum.enumValues[number];
export type LoopStopReason = typeof loopStopReasonEnum.enumValues[number];
export type OptimizationMode = typeof optimizationModeEnum.enumValues[number];
export type IterationStatus = typeof iterationStatusEnum.enumValues[number];
