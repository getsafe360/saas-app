// lib/db/schema/index.ts
// Hybrid schema - grouped new tables + legacy schema

// ============================================
// Shared enums (always import first)
// ============================================
export * from './_shared/enums';

// ============================================
// Grouped tables - EXPLICIT EXPORTS
// ============================================

// Auth tables
export { users } from './auth/users';
export { teams, teamMembers, invitations } from './auth/teams';

// Auth types
export type { User, NewUser } from './auth/users';
export type { Team, NewTeam, TeamMember, NewTeamMember } from './auth/teams';

// Sites
export { sites, connectionLogs } from './sites/sites';
export type { Site, NewSite, ConnectionLog, NewConnectionLog } from './sites/sites';

// Billing
export { plans, planPrices, planTranslations } from './billing/plans';
export type { Plan, PlanPrice } from './billing/plans';
export { teamSubscriptions, planPackInclusions } from './billing/subscriptions';
export type { TeamSubscription } from './billing/subscriptions';

// Features
export { cockpitLayouts } from './features/cockpit-layouts';
export type { 
  CockpitLayout, 
  NewCockpitLayout, 
  CockpitLayoutData, 
  CockpitCardLayout 
} from './features/cockpit-layouts';

// ============================================
// Modular schema - All tables
// ============================================

// Jobs
export { scanJobs, fixJobs, editJobs } from './jobs/scans';
export type { ScanJob, NewScanJob, FixJob, NewFixJob, EditJob } from './jobs/scans';
export { packRuns } from './jobs/packs';

// Activity
export { activityLogs } from './activity/logs';
export type { ActivityLog, NewActivityLog } from './activity/logs';

// Guests
export { guestSessions, guestScans } from './guests/sessions';
export type { GuestSession, GuestScan } from './guests/sessions';

// System
export { idempotency, blobGc } from './system/maintenance';

// Scans
export { scheduledScans, scanSummaries } from './scans/scheduled';
export type { ScheduledScan, ScanSummary } from './scans/scheduled';

// Co-pilot
export { snapshots, changeSets, changeItems } from './copilot/changes';
export type { Snapshot, ChangeSet, ChangeItem } from './copilot/changes';

// Packs
export { appPacks, appPackTranslations, appPackPrices, sitePacks } from './packs/catalog';
export type { AppPack, AppPackPrice } from './packs/catalog';

// Locales
export { supportedLocales } from './locales/supported';
export type { SupportedLocale } from './locales/supported';

// Payments
export { paymentMethods, paymentMethodTranslations } from './payments/methods';
export type { PaymentMethod } from './payments/methods';
export { regionPaymentMethods, taxDisplayPolicies } from './payments/regions';
export type { RegionPaymentMethod, TaxDisplayPolicy } from './payments/regions';

// Admin
export { webhookEvents } from './admin/webhooks';
export type { WebhookEvent } from './admin/webhooks';
export { adminActions, adminNotes } from './admin/actions';
export type { AdminAction, AdminNote } from './admin/actions';

// AI Analysis
export { aiAnalysisJobs, aiRepairActions } from './ai/analysis';
export type { AiAnalysisJob, NewAiAnalysisJob, AiRepairAction, NewAiRepairAction } from './ai/analysis';