import { PLAN_PRICE_IDS } from './catalogue';

export const PRO_PLAN_PRICE_EUR = Number(process.env.PRO_PLAN_PRICE_EUR ?? 19);

export type LogicalPlanId = 'free' | 'pro' | 'agent' | 'business';

export interface LogicalPlanDefinition {
  id: LogicalPlanId;
  name: string;
  monthlyPriceEur: number | null;
  description: string;
  features: string[];
  stripePriceId?: string; // monthly price; see catalogue.ts for yearly
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
    stripePriceId: PLAN_PRICE_IDS.pro.monthly,
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
    stripePriceId: PLAN_PRICE_IDS.agent.monthly,
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
  [PLAN_PRICE_IDS.pro.monthly]: 'pro',
  [PLAN_PRICE_IDS.pro.yearly]: 'pro',
  [PLAN_PRICE_IDS.agent.monthly]: 'agent',
  [PLAN_PRICE_IDS.agent.yearly]: 'agent',
};
