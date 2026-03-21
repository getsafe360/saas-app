export type BillingCycle = "monthly" | "yearly";

export interface PlanDefinition {
  nameKey: string;
  descriptionKey: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  bestForKey: string;
  stripeUrl?: string;
  borderColorToken: string;
  type: "free" | "pro" | "agency";
  ctaLabelKey: string;
}

export interface TokenPackDefinition {
  nameKey: string;
  descriptionKey: string;
  price: string;
  stripeUrl: string;
}

export const PRICING_PLANS: PlanDefinition[] = [
  {
    nameKey: "plans.payg.name", 
    descriptionKey: "plans.payg.description",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "plans.payg.features.tools",
      "plans.payg.features.optimization",
      "plans.payg.features.wp",
      "plans.payg.features.accessibility",
      "plans.payg.features.tokenUsage",
      "plans.payg.features.noMonthlyFees",
      "plans.payg.features.lowFrequency",
    ],
    bestForKey: "plans.payg.bestFor",
    borderColorToken: "var(--color-primary-700)",
    type: "free",
    ctaLabelKey: "plans.payg.cta",
  },
  {
    nameKey: "plans.pro.name",
    descriptionKey: "plans.pro.description",
    priceMonthly: 19,
    priceYearly: 190,
    features: [
      "plans.pro.features.optimization",
      "plans.pro.features.accessibility",
      "plans.pro.features.contentCreator",
      "plans.pro.features.oneClickFixes",
      "plans.pro.features.sparky",
      "plans.pro.features.unlimitedRepairs",
      "plans.pro.features.unlimitedBuilds",
      "plans.pro.features.multiSite",
    ],
    bestForKey: "plans.pro.bestFor",
    stripeUrl: "https://buy.getsafe360.ai/b/8x214mfQud5mbNf84abAs00",
    borderColorToken: "var(--color-primary-500)",
    type: "pro",
    ctaLabelKey: "plans.pro.cta",
  },
  {
    nameKey: "plans.agency.name",
    descriptionKey: "plans.agency.description",
    priceMonthly: 49,
    priceYearly: 490,
    features: [
      "plans.agency.features.everythingInPro",
      "plans.agency.features.whiteLabelReports",
      "plans.agency.features.priorityProcessing",
      "plans.agency.features.multiClient",
    ],
    bestForKey: "plans.agency.bestFor",
    stripeUrl: "https://buy.getsafe360.ai/b/14AbJ09s61mE2cF5W2bAs01",
    borderColorToken: "var(--color-primary-300)",
    type: "agency",
    ctaLabelKey: "plans.agency.cta",
  },
];

export const TOKEN_PACKS: TokenPackDefinition[] = [
  {
    nameKey: "tokenPacks.items.small",
    descriptionKey: "tokenPacks.items.small.description",
    price: "€5",
    stripeUrl: "https://buy.getsafe360.ai/b/8x214m9s69Ta5oR4RYbAs03",
  },
  {
    nameKey: "tokenPacks.items.medium",
    descriptionKey: "tokenPacks.items.medium.description",
    price: "€10",
    stripeUrl: "https://buy.getsafe360.ai/b/dRm8wO9s6d5mbNf2JQbAs02",
  },
  {
    nameKey: "tokenPacks.items.large",
    descriptionKey: "tokenPacks.items.large.description",
    price: "€15",
    stripeUrl: "https://buy.getsafe360.ai/b/eVq14m1ZE4yQg3v706bAs04",
  },
];

export const PRICING_FOOTNOTES = [
  "footnotes.saveTwoMonths",
  "footnotes.fairUse",
  "footnotes.tokenVaries",
];

export const PRICING_DISCLAIMERS = [
  "disclaimers.cancelAnytime",
  "disclaimers.excludeVat",
];

export const PRICING_FAQ = [
  {
    questionKey: "faq.items.tokens.question",
    answerKey: "faq.items.tokens.answer",
  },
  {
    questionKey: "faq.items.switchPlans.question",
    answerKey: "faq.items.switchPlans.answer",
  },
  {
    questionKey: "faq.items.expire.question",
    answerKey: "faq.items.expire.answer",
  },
  {
    questionKey: "faq.items.anyPlan.question",
    answerKey: "faq.items.anyPlan.answer",
  },
];
