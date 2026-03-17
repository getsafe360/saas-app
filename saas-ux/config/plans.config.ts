export type BillingCycle = "monthly" | "yearly";

export interface PlanDefinition {
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  bestFor: string;
  stripeUrl?: string;
  borderColorToken: string;
  type: "free" | "pro" | "agency";
  ctaLabel: string;
}

export interface TokenPackDefinition {
  name: string;
  price: string;
  stripeUrl: string;
}

export const PRICING_PLANS: PlanDefinition[] = [
  {
    name: "Pay-as-you-go",
    description:
      "Our most flexible option for webmasters and small teams. Pay only for the fixes and analyses you need — perfect for emerging sites or occasional maintenance without a monthly commitment.",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "Access to all analysis tools",
      "On-demand AI repairs (token-based)",
      "No monthly fees",
      "Ideal for low-frequency usage",
    ],
    bestFor: "Webmasters, small teams, and new projects.",
    borderColorToken: "var(--color-primary-700)",
    type: "free",
    ctaLabel: "Create free account",
  },
  {
    name: "Pro",
    description:
      "Unlimited AI repairs, builds, and analysis tools. Ideal for developers, freelancers, and organizations managing one or more sites. Full power without limits.",
    priceMonthly: 19,
    priceYearly: 190,
    features: [
      "Unlimited AI repairs",
      "Unlimited builds",
      "Full site analysis suite",
      "Multi-site support",
      "Priority queue",
    ],
    bestFor: "Developers, freelancers, and growing organizations.",
    stripeUrl: "https://buy.stripe.com/8x214mfQud5mbNf84abAs00",
    borderColorToken: "var(--color-primary-500)",
    type: "pro",
    ctaLabel: "Start Pro",
  },
  {
    name: "Agency",
    description:
      "Built for agencies and professionals managing multiple client sites. Includes client-ready white-label reports, priority processing, and advanced collaboration features.",
    priceMonthly: 49,
    priceYearly: 490,
    features: [
      "Everything in Pro",
      "White-label client reports",
      "Priority processing",
      "Team collaboration features",
      "Multi-client management",
    ],
    bestFor: "Agencies, studios, and professionals managing multiple client sites.",
    stripeUrl: "https://buy.stripe.com/14AbJ09s61mE2cF5W2bAs01",
    borderColorToken: "var(--color-primary-300)",
    type: "agency",
    ctaLabel: "Start Agency",
  },
];

export const TOKEN_PACKS: TokenPackDefinition[] = [
  {
    name: "Small",
    price: "€5",
    stripeUrl: "https://buy.stripe.com/8x214m9s69Ta5oR4RYbAs03",
  },
  {
    name: "Medium",
    price: "€10",
    stripeUrl: "https://buy.stripe.com/dRm8wO9s6d5mbNf2JQbAs02",
  },
  {
    name: "Large",
    price: "€15",
    stripeUrl: "https://buy.stripe.com/eVq14m1ZE4yQg3v706bAs04",
  },
];

export const PRICING_FOOTNOTES = [
  "Annual billing saves you 2 months.",
  "Unlimited usage is subject to fair-use guidelines.",
  "Token consumption varies by operation complexity.",
];

export const PRICING_DISCLAIMERS = [
  "Cancel anytime. No hidden fees.",
  "Prices exclude VAT where applicable.",
];

export const PRICING_FAQ = [
  {
    question: "How do tokens work?",
    answer:
      "Tokens are used to pay for AI-powered repairs, builds, and advanced analyses. Each operation consumes a specific number of tokens based on complexity.",
  },
  {
    question: "Can I switch plans later?",
    answer:
      "Yes. You can upgrade or downgrade your plan at any time from your account settings.",
  },
  {
    question: "Do my tokens expire?",
    answer:
      "Tokens do not expire within the current billing year. We’ll notify you well in advance if this changes.",
  },
  {
    question: "Can I use token packs on any plan?",
    answer: "Yes. Token packs work with all plans, including Pay-as-you-go.",
  },
];
