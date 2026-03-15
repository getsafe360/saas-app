// lib/plans/config.ts
// Pricing plans and token pack configurations
import { TOKENS_PER_FIX_UNIT } from '@/config/billing/token-economy';
import { TOKEN_PACKS as SHARED_TOKEN_PACKS } from '@/config/billing/token-packs';

export type PlanName = 'free' | 'pro' | 'agent' | 'business' | 'agency';

export interface PlanConfig {
  name: PlanName;
  displayName: string;
  description: string;
  price: number; // in cents (EUR)
  priceDisplay: string;
  stripePriceId: string | null; // null for free plan
  stripeBuyButtonId: string | null; // null for free plan
  stripeCheckoutUrl: string | null; // Direct link to Stripe checkout
  tokensIncluded: number; // Monthly token allowance
  features: string[];
  isPopular?: boolean;
}

export interface TokenPackConfig {
  id: string;
  name: string;
  tokens: number;
  price: number; // in cents (EUR)
  priceDisplay: string;
  stripePriceId: string;
  stripeBuyButtonId: string;
  stripeCheckoutUrl: string; // Direct link to Stripe checkout
  savingsPercent?: number;
}

/**
 * Subscription Plans
 *
 * Token economics:
 * - ~2,000 tokens per AI fix
 * - ~$0.04 per fix in API costs
 *
 * Pricing philosophy:
 * - Unlimited free site analyses (remove all barriers)
 * - Pay only for AI fixes (token-based)
 * - Fair usage caps with soft limits (like mobile data)
 */
export const PLANS: Record<PlanName, PlanConfig> = {
  free: {
    name: 'free',
    displayName: 'Free',
    description: 'Perfect for trying GetSafe 360',
    price: 0,
    priceDisplay: '€0',
    stripePriceId: null,
    stripeBuyButtonId: null,
    stripeCheckoutUrl: null,
    tokensIncluded: 5000, // ~2-3 AI fixes
    features: [
      'Unlimited site analyses',
      '5,000 tokens/month (~2-3 AI fixes)',
      'Performance & security insights',
      'SEO & accessibility reports',
      'Basic support',
    ],
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    description: 'Best for professionals and agencies',
    price: 1900, // €19.00
    priceDisplay: '€19',
    stripePriceId: 'price_1SpxHnCs6GUQsp1IUuZiUj99',
    stripeBuyButtonId: 'buy_btn_1Sr2sSCs6GUQsp1IxgHcbCpJ',
    stripeCheckoutUrl: 'https://buy.getsafe360.ai/b/8x214mfQud5mbNf84abAs00',
    tokensIncluded: 100000, // ~50 AI fixes
    features: [
      'Unlimited site analyses',
      '100,000 tokens/month (~50 AI fixes)',
      'Priority AI processing',
      'Advanced insights & recommendations',
      'Email support',
      'Monthly usage reports',
    ],
    isPopular: true,
  },
  agent: {
    name: 'agent',
    displayName: 'Agent',
    description: 'For agencies and professionals managing multiple client sites',
    price: 4900, // €49.00
    priceDisplay: '€49',
    stripePriceId: 'price_1SpxuBCs6GUQsp1IriBKXbat',
    stripeBuyButtonId: 'buy_btn_1Sr2ybCs6GUQsp1IMUpTefbp',
    stripeCheckoutUrl: 'https://buy.getsafe360.ai/b/14AbJ09s61mE2cF5W2bAs01',
    tokensIncluded: 300000, // ~150 AI fixes
    features: [
      'Unlimited site analyses',
      '300,000 tokens/month (~150 AI fixes)',
      'Priority AI processing',
      'White-label reports',
      'Dedicated support',
      'Team collaboration',
      'Custom integrations',
    ],
  },
  agency: {
    name: 'agency',
    displayName: 'Agency',
    description: 'Legacy alias for Agent',
    price: 4900,
    priceDisplay: '€49',
    stripePriceId: 'price_1SpxuBCs6GUQsp1IriBKXbat',
    stripeBuyButtonId: 'buy_btn_1Sr2ybCs6GUQsp1IMUpTefbp',
    stripeCheckoutUrl: 'https://buy.getsafe360.ai/b/14AbJ09s61mE2cF5W2bAs01',
    tokensIncluded: 300000,
    features: [
      'Everything in Pro',
      'Unlimited sites',
      'Client-ready reports',
      'Best queue priority',
    ],
  },
  business: {
    name: 'business',
    displayName: 'Business',
    description: 'Custom enterprise plan',
    price: 0,
    priceDisplay: 'Custom',
    stripePriceId: null,
    stripeBuyButtonId: null,
    stripeCheckoutUrl: null,
    tokensIncluded: 0,
    features: [
      'Everything in Agent',
      'Team seats',
      'SLA',
      'API access (future)',
      'Custom integrations',
    ],
  },
};

/**
 * Token Packs (One-time purchases)
 *
 * These tokens never expire and can be used anytime.
 * Perfect for occasional users or as top-ups for Pro/Agency plans.
 */
export const TOKEN_PACKS: TokenPackConfig[] = [
  ...SHARED_TOKEN_PACKS.map((pack) => ({
    id: pack.id,
    name: pack.name,
    tokens: pack.tokens,
    price: pack.priceEur * 100,
    priceDisplay: `€${pack.priceEur}`,
    stripePriceId: pack.stripePriceId,
    stripeBuyButtonId: '',
    stripeCheckoutUrl: pack.stripeCheckoutUrl,
    savingsPercent: pack.id === 'medium' ? 25 : pack.id === 'large' ? 33 : undefined,
  })),
];

/**
 * Usage thresholds for notifications
 */
export const USAGE_THRESHOLDS = {
  WARNING: 0.8, // 80% - send first warning
  CRITICAL: 1.0, // 100% - send critical alert
} as const;

/**
 * Token cost estimates for different operations
 */
export const TOKEN_COSTS = {
  AI_FIX: TOKENS_PER_FIX_UNIT,
  ANALYSIS: 0, // Site analyses are free
} as const;

/**
 * Helper function to get plan by name
 */
export function getPlan(planName: PlanName): PlanConfig {
  return PLANS[planName];
}

/**
 * Helper function to get token pack by Stripe price ID
 */
export function getTokenPackByPriceId(priceId: string): TokenPackConfig | null {
  return TOKEN_PACKS.find(pack => pack.stripePriceId === priceId) || null;
}

/**
 * Helper function to get plan by Stripe price ID
 */
export function getPlanByPriceId(priceId: string): PlanConfig | null {
  return Object.values(PLANS).find(plan => plan.stripePriceId === priceId) || null;
}

/**
 * Calculate available tokens for a team
 */
export function calculateAvailableTokens(
  tokensIncluded: number,
  tokensPurchased: number,
  tokensUsedThisMonth: number
): number {
  const totalTokens = tokensIncluded + tokensPurchased;
  const available = totalTokens - tokensUsedThisMonth;
  return Math.max(0, available);
}

/**
 * Check if team has enough tokens
 */
export function hasEnoughTokens(
  tokensIncluded: number,
  tokensPurchased: number,
  tokensUsedThisMonth: number,
  tokensNeeded: number
): boolean {
  const available = calculateAvailableTokens(tokensIncluded, tokensPurchased, tokensUsedThisMonth);
  return available >= tokensNeeded;
}

/**
 * Calculate usage percentage (0-1)
 */
export function calculateUsagePercentage(
  tokensIncluded: number,
  tokensPurchased: number,
  tokensUsedThisMonth: number
): number {
  const total = tokensIncluded + tokensPurchased;
  if (total === 0) return 0;
  return Math.min(1, tokensUsedThisMonth / total);
}

// ============================================
// Feature Gating - Plan-based feature access
// ============================================

/**
 * Feature flags by plan
 */
export interface PlanFeatures {
  // Report generation
  reportGeneration: boolean;
  whiteLabel: boolean;
  exportFormats: ('pdf' | 'csv' | 'html')[];

  // Advanced features
  priorityProcessing: boolean;
  teamCollaboration: boolean;
  customIntegrations: boolean;
  scheduledScans: boolean;

  // Limits
  maxSites: number;              // Max sites per account
  maxTeamMembers: number;        // Max team members
  reportRetentionDays: number;   // How long reports are stored
}

/**
 * Feature configuration by plan
 */
export const PLAN_FEATURES: Record<PlanName, PlanFeatures> = {
  free: {
    reportGeneration: false,
    whiteLabel: false,
    exportFormats: [],
    priorityProcessing: false,
    teamCollaboration: false,
    customIntegrations: false,
    scheduledScans: false,
    maxSites: 3,
    maxTeamMembers: 1,
    reportRetentionDays: 0,
  },
  pro: {
    reportGeneration: false,    // Upsell opportunity to Agency
    whiteLabel: false,
    exportFormats: [],
    priorityProcessing: true,
    teamCollaboration: false,
    customIntegrations: false,
    scheduledScans: true,
    maxSites: 25,
    maxTeamMembers: 3,
    reportRetentionDays: 0,
  },
  agent: {
    reportGeneration: true,
    whiteLabel: true,
    exportFormats: ['pdf', 'csv', 'html'],
    priorityProcessing: true,
    teamCollaboration: true,
    customIntegrations: true,
    scheduledScans: true,
    maxSites: 100,
    maxTeamMembers: 10,
    reportRetentionDays: 365,
  },
  agency: {
    reportGeneration: true,
    whiteLabel: true,
    exportFormats: ['pdf', 'csv', 'html'],
    priorityProcessing: true,
    teamCollaboration: true,
    customIntegrations: true,
    scheduledScans: true,
    maxSites: 100,
    maxTeamMembers: 10,
    reportRetentionDays: 365,
  },
  business: {
    reportGeneration: true,
    whiteLabel: true,
    exportFormats: ['pdf', 'csv', 'html'],
    priorityProcessing: true,
    teamCollaboration: true,
    customIntegrations: true,
    scheduledScans: true,
    maxSites: 1000,
    maxTeamMembers: 100,
    reportRetentionDays: 3650,
  },
};

/**
 * Check if a plan has access to a specific feature
 */
export function hasFeature<K extends keyof PlanFeatures>(
  planName: PlanName,
  feature: K
): PlanFeatures[K] {
  return PLAN_FEATURES[planName][feature];
}

/**
 * Check if plan can generate reports
 */
export function canGenerateReports(planName: PlanName): boolean {
  return PLAN_FEATURES[planName].reportGeneration;
}

/**
 * Check if plan supports white-label branding
 */
export function canUseWhiteLabel(planName: PlanName): boolean {
  return PLAN_FEATURES[planName].whiteLabel;
}

/**
 * Get available export formats for a plan
 */
export function getAvailableExportFormats(planName: PlanName): ('pdf' | 'csv' | 'html')[] {
  return PLAN_FEATURES[planName].exportFormats;
}

/**
 * Check if a specific export format is available
 */
export function canExportFormat(planName: PlanName, format: 'pdf' | 'csv' | 'html'): boolean {
  return PLAN_FEATURES[planName].exportFormats.includes(format);
}

/**
 * Get the minimum plan required for a feature
 */
export function getMinimumPlanForFeature(feature: keyof PlanFeatures): PlanName {
  const planOrder: PlanName[] = ['free', 'pro', 'agent', 'business'];

  for (const plan of planOrder) {
    const featureValue = PLAN_FEATURES[plan][feature];
    // For boolean features, check if true
    // For arrays, check if non-empty
    // For numbers, check if greater than 0
    if (
      featureValue === true ||
      (Array.isArray(featureValue) && featureValue.length > 0) ||
      (typeof featureValue === 'number' && featureValue > 0)
    ) {
      return plan;
    }
  }

  return 'business'; // Default to highest tier
}

/**
 * Get upgrade suggestion for a feature
 */
export function getUpgradeSuggestion(
  currentPlan: PlanName,
  feature: keyof PlanFeatures
): { suggestedPlan: PlanName; price: string } | null {
  const requiredPlan = getMinimumPlanForFeature(feature);
  const planOrder: PlanName[] = ['free', 'pro', 'agent', 'business'];

  const currentIndex = planOrder.indexOf(currentPlan);
  const requiredIndex = planOrder.indexOf(requiredPlan);

  if (requiredIndex > currentIndex) {
    return {
      suggestedPlan: requiredPlan,
      price: PLANS[requiredPlan].priceDisplay,
    };
  }

  return null;
}
