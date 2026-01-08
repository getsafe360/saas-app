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

// Features
export { cockpitLayouts } from './features/cockpit-layouts';
export type { 
  CockpitLayout, 
  NewCockpitLayout, 
  CockpitLayoutData, 
  CockpitCardLayout 
} from './features/cockpit-layouts';

// ============================================
// Legacy schema - Everything else
// ============================================
// NOTE: Using explicit named exports to avoid TypeScript conflicts
// with tables that import from modular structure

// Jobs
export { scanJobs } from '../schema';
export { fixJobs } from '../schema';
export { editJobs } from '../schema';
export { packRuns } from '../schema';

// Activity
export { activityLogs } from '../schema';

// Guests
export { guestSessions } from '../schema';
export { guestScans } from '../schema';
export { idempotency } from '../schema';
export { blobGc } from '../schema';

// Scans
export { scheduledScans } from '../schema';
export { scanSummaries } from '../schema';

// Co-pilot
export { snapshots } from '../schema';
export { changeSets } from '../schema';
export { changeItems } from '../schema';

// Packs
export { appPacks } from '../schema';
export { appPackTranslations } from '../schema';
export { appPackPrices } from '../schema';
export { sitePacks } from '../schema';

// Locales
export { supportedLocales } from '../schema';

// Billing (rest)
export { planPackInclusions } from '../schema';
export { teamSubscriptions } from '../schema';

// Payments
export { paymentMethods } from '../schema';
export { paymentMethodTranslations } from '../schema';
export { regionPaymentMethods } from '../schema';
export { taxDisplayPolicies } from '../schema';

// Admin
export { webhookEvents } from '../schema';
export { adminActions } from '../schema';
export { adminNotes } from '../schema';

// Legacy types
export type { ScanJob, NewScanJob } from '../schema';
export type { FixJob, NewFixJob } from '../schema';
export type { ActivityLog, NewActivityLog } from '../schema';
export type { GuestSession, GuestScan } from '../schema';
export type { ScheduledScan, ScanSummary } from '../schema';
export type { Snapshot, ChangeSet, ChangeItem } from '../schema';
export type { EditJob } from '../schema';
export type { AppPack, AppPackPrice } from '../schema';
export type { SupportedLocale } from '../schema';
export type { TeamSubscription } from '../schema';
export type { PaymentMethod, RegionPaymentMethod, TaxDisplayPolicy } from '../schema';
export type { WebhookEvent, AdminAction, AdminNote } from '../schema';