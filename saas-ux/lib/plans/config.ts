// lib/plans/config.ts
// Pricing plans and token pack configurations

export type PlanName = 'free' | 'pro' | 'agency';

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
    stripeCheckoutUrl: null, // TODO: Add Pro plan Stripe checkout URL
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
  agency: {
    name: 'agency',
    displayName: 'Agency',
    description: 'For agencies managing multiple clients',
    price: 4900, // €49.00
    priceDisplay: '€49',
    stripePriceId: 'price_1SpxuBCs6GUQsp1IriBKXbat',
    stripeBuyButtonId: 'buy_btn_1Sr2ybCs6GUQsp1IMUpTefbp',
    stripeCheckoutUrl: 'https://buy.getsafe360.ai/b/14AbJ09s61mE2cF5W2bAs01?locale=en',
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
};

/**
 * Token Packs (One-time purchases)
 *
 * These tokens never expire and can be used anytime.
 * Perfect for occasional users or as top-ups for Pro/Agency plans.
 */
export const TOKEN_PACKS: TokenPackConfig[] = [
  {
    id: 'small',
    name: 'Small Pack',
    tokens: 10000, // ~5 AI fixes
    price: 500, // €5.00
    priceDisplay: '€5',
    stripePriceId: 'price_1SqaxtCs6GUQsp1IL0d9dOgV',
    stripeBuyButtonId: 'buy_btn_1Sr34XCs6GUQsp1IkA8tPkeC',
    stripeCheckoutUrl: '', // TODO: Add Small Pack Stripe checkout URL
  },
  {
    id: 'medium',
    name: 'Medium Pack',
    tokens: 25000, // ~12 AI fixes
    price: 1000, // €10.00
    priceDisplay: '€10',
    stripePriceId: 'price_1SqazKCs6GUQsp1IP9mYvV5n',
    stripeBuyButtonId: 'buy_btn_1Sr32bCs6GUQsp1IBbqDko7o',
    stripeCheckoutUrl: '', // TODO: Add Medium Pack Stripe checkout URL
    savingsPercent: 25, // 25% more tokens than 2x small
  },
  {
    id: 'large',
    name: 'Large Pack',
    tokens: 40000, // ~20 AI fixes
    price: 1500, // €15.00
    priceDisplay: '€15',
    stripePriceId: 'price_1Sqb0CCs6GUQsp1INNhNduLq',
    stripeBuyButtonId: 'buy_btn_1Sr35qCs6GUQsp1IpsO9Wuil',
    stripeCheckoutUrl: '', // TODO: Add Large Pack Stripe checkout URL
    savingsPercent: 33, // 33% more tokens than 3x small
  },
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
  AI_FIX: 2000, // Average tokens per AI fix
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
