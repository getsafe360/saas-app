// lib/db/schema/_shared/enums.ts
// Shared enums used across multiple schema groups

import { pgEnum } from 'drizzle-orm/pg-core';

// Job status shared by scans/fixes/edits/pack_runs
export const jobStatusEnum = pgEnum('job_status', [
  'queued', 'running', 'done', 'error', 'cancelled'
]);

// Site connectivity
export const siteStatusEnum = pgEnum('site_status', [
  'pending', 'connected', 'disconnected'
]);

// Which agent executed a job
export const agentEnum = pgEnum('agent', [
  'external', 'fallback', 'internal'
]);

// Activity log event codes (translate in UI, not in DB)
export const activityEventEnum = pgEnum('activity_event', [
  'site_created', 'site_updated', 'site_deleted', 'connected', 'disconnected',
  'scan_started', 'scan_finished', 'scan_failed',
  'fix_started', 'fix_finished', 'fix_failed',
  'changeset_created', 'changeset_approved', 'changeset_applied', 'changeset_rolled_back', 'changeset_failed',
  'pack_installed', 'pack_uninstalled', 'pack_run_started', 'pack_run_finished', 'pack_run_failed'
]);

// Change set lifecycle for co-pilot
export const changeSetStatusEnum = pgEnum('changeset_status', [
  'draft', 'approved', 'applied', 'rolled_back', 'failed'
]);

// AI analysis job status
export const aiJobStatusEnum = pgEnum('ai_job_status', [
  'pending', 'running', 'completed', 'failed', 'cancelled'
]);

// AI repair action status
export const aiRepairStatusEnum = pgEnum('ai_repair_status', [
  'pending', 'running', 'completed', 'failed', 'skipped'
]);
