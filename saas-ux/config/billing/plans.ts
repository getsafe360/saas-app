export const PRO_PLAN_PRICE_EUR = Number(process.env.PRO_PLAN_PRICE_EUR ?? 19);

export type LogicalPlanId = 'free' | 'pro' | 'agent' | 'business';

export interface LogicalPlanDefinition {
  id: LogicalPlanId;
  name: string;
  monthlyPriceEur: number | null;
  description: string;
  features: string[];
  stripePriceId?: string;
  stripeCheckoutUrl?: string;
}

export const LOGICAL_PLANS: LogicalPlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPriceEur: 0,
    description: "Perfect to understand your site's health with no commitment.",
    features: [
      'Unlimited site analyses',
      'Access to cockpit & scores',
      'Pay-as-you-go repairs via token packs',
      'No automated monthly repairs',
      'No white-label reports',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPriceEur: 19,
    description: 'For growing sites that need automated repairs.',
    features: [
      'Unlimited AI repairs (no token packs required)',
      'Automated monthly repairs (where supported)',
      'Full cockpit access',
      'Priority processing over Free',
      'Basic reports',
    ],
    stripePriceId: 'price_1SpxHnCs6GUQsp1IUuZiUj99',
    stripeCheckoutUrl: 'https://buy.getsafe360.ai/b/8x214mfQud5mbNf84abAs00',
  },
  {
    id: 'agent',
    name: 'Agent',
    monthlyPriceEur: 49,
    description: 'For agencies and professionals managing multiple client sites.',
    features: [
      'Everything in Pro',
      'Unlimited sites (or a generous limit, configurable)',
      'Client-ready reports (PDF/white-label)',
      'Multi-site cockpit',
      'Best queue priority',
    ],
    stripePriceId: 'price_1SpxuBCs6GUQsp1IriBKXbat',
    stripeCheckoutUrl: 'https://buy.getsafe360.ai/b/14AbJ09s61mE2cF5W2bAs01',
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPriceEur: null,
    description: 'For teams and organizations that need scale, control, and SLAs.',
    features: [
      'Everything in Agent',
      'Team seats',
      'SLA',
      'API access (future)',
      'Custom integrations',
    ],
  },
];

export const STRIPE_PLAN_MAPPING: Record<string, LogicalPlanId> = {
  price_1SpxHnCs6GUQsp1IUuZiUj99: 'pro',
  price_1SpxuBCs6GUQsp1IriBKXbat: 'agent',
};
