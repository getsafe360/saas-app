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
export { sites } from './sites/sites';
export type { Site, NewSite } from './sites/sites';

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
export {
  // Jobs
  scanJobs,
  fixJobs,
  editJobs,
  packRuns,
  
  // Activity
  activityLogs,
  
  // Guests
  guestSessions,
  guestScans,
  idempotency,
  blobGc,
  
  // Scans
  scheduledScans,
  scanSummaries,
  
  // Co-pilot
  snapshots,
  changeSets,
  changeItems,
  
  // Packs
  appPacks,
  appPackTranslations,
  appPackPrices,
  sitePacks,
  
  // Locales
  supportedLocales,
  
  // Billing (rest)
  planPackInclusions,
  teamSubscriptions,
  
  // Payments
  paymentMethods,
  paymentMethodTranslations,
  regionPaymentMethods,
  taxDisplayPolicies,
  
  // Admin
  webhookEvents,
  adminActions,
  adminNotes,
  
  // Legacy types
  type ScanJob,
  type NewScanJob,
  type FixJob,
  type NewFixJob,
  type ActivityLog,
  type NewActivityLog,
  type GuestSession,
  type GuestScan,
  type ScheduledScan,
  type ScanSummary,
  type Snapshot,
  type ChangeSet,
  type ChangeItem,
  type EditJob,
  type AppPack,
  type AppPackPrice,
  type SupportedLocale,
  type TeamSubscription,
  type PaymentMethod,
  type RegionPaymentMethod,
  type TaxDisplayPolicy,
  type WebhookEvent,
  type AdminAction,
  type AdminNote,
} from '../schema';