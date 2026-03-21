const PRICING_COPY: Record<string, string> = {
  "hero.title": "Plans & Pricing",
  "hero.description": "Choose the plan that matches your workflow.",

  "billing.monthly": "Monthly",
  "billing.yearly": "Yearly",
  "billing.save": "save 2 months",
  "billing.toggleAria": "Toggle billing cycle",

  "labels.perMonth": "/month",
  "labels.perYear": "/year",
  "labels.bestFor": "Best for:",
  "labels.custom": "Free",

  // PAYG
  "plans.payg.name": "Pay-as-you-go",
  "plans.payg.description":
    "Flexible, commitment-free access to all Pro-level tools. Buy tokens and fix issues instantly — only pay when you need help.",
  "plans.payg.bestFor": "Webmasters, DIY site owners, small businesses.",
  "plans.payg.cta": "Start PAYG Plan →",

  "plans.payg.features.tools": "Access to all AI tools",
  "plans.payg.features.optimization": "SEO, GEO & AEO tools",
  "plans.payg.features.wp": "WordPress toolset",
  "plans.payg.features.accessibility": "Accessibility, performance & security tools",
  "plans.payg.features.tokenUsage": "Token-based usage",
  "plans.payg.features.noMonthlyFees": "No monthly fees",
  "plans.payg.features.lowFrequency": "Ideal for low-frequency maintenance",

  // PRO
  "plans.pro.name": "Pro",
  "plans.pro.description":
    "Unlimited AI repairs, builds, and optimization tools for professionals managing one or multiple sites.",
  "plans.pro.bestFor": "Developers, freelancers, and growing organizations.",
  "plans.pro.cta": "Start Pro Plan →",

  "plans.pro.features.optimization": "SEO, GEO & AEO tools",
  "plans.pro.features.accessibility": "Accessibility, performance & security tools",
  "plans.pro.features.contentCreator": "Content creator/writer",
  "plans.pro.features.oneClickFixes": "One-click fixes",
  "plans.pro.features.sparky": "Sparky AI assistant",
  "plans.pro.features.multiSite": "Multi-site support",
  "plans.pro.features.unlimitedRepairs": "Unlimited AI repairs",
  "plans.pro.features.unlimitedBuilds": "Unlimited builds",

  // AGENCY
  "plans.agency.name": "Agency",
  "plans.agency.description":
    "Unlimited usage for agencies managing multiple client sites. Deliver client-ready reports in seconds and scale your client operations.",
  "plans.agency.bestFor":
    "Agencies, studios, and professionals managing multiple client sites.",
  "plans.agency.cta": "Start Agency Plan →",

  "plans.agency.features.everythingInPro": "Everything in Pro",
  "plans.agency.features.whiteLabelReports": "White-label client reports",
  "plans.agency.features.priorityProcessing": "Priority processing",
  "plans.agency.features.multiClient": "Multi-client management",

// Token Packs
"tokenPacks.title": "Token Packs",
"tokenPacks.description":
  "Buy tokens on demand and keep AI operations moving with no subscription lock-in.",
"tokenPacks.button": "Buy tokens",

"tokenPacks.items.small": "Small",
"tokenPacks.items.small.description":
  "10,000 AI tokens for automated fixes (~25 website operations). One-time purchase — tokens never expire.",

"tokenPacks.items.medium": "Medium",
"tokenPacks.items.medium.description":
  "25,000 AI tokens for automated fixes (~50 website operations). Great value — tokens never expire.",

"tokenPacks.items.large": "Large",
"tokenPacks.items.large.description":
  "50,000 AI tokens for automated fixes (~100 website operations). Maximum value — tokens never expire.",

  // Footnotes
  "footnotes.saveTwoMonths": "Annual billing saves you 2 months.",
  "footnotes.fairUse": "Unlimited usage is subject to fair-use guidelines.",
  "footnotes.tokenVaries": "Token consumption varies by operation complexity.",

  // Disclaimers
  "disclaimers.cancelAnytime": "Cancel anytime. No hidden fees.",
  "disclaimers.excludeVat": "Prices exclude VAT where applicable.",

  // FAQ
  "faq.title": "Pricing & Tokens FAQ",
  "faq.items.tokens.question": "How do tokens work?",
  "faq.items.tokens.answer":
    "Tokens are used to pay for AI-powered repairs, builds, and advanced analyses. Each operation consumes a specific number of tokens based on complexity.",
  "faq.items.switchPlans.question": "Can I switch plans later?",
  "faq.items.switchPlans.answer":
    "Yes. You can upgrade or downgrade your plan at any time from your account settings.",
  "faq.items.expire.question": "Do my tokens expire?",
  "faq.items.expire.answer":
    "Tokens do not expire within the current billing year. We’ll notify you well in advance if this changes.",
  "faq.items.anyPlan.question": "Can I use token packs on any plan?",
  "faq.items.anyPlan.answer":
    "Yes. Token packs work with all plans, including Pay-as-you-go.",

  // Tooltips
  "tooltips.unlimitedRepairs":
    "Run as many AI repairs as you need without limits.",
  "tooltips.unlimitedBuilds":
    "Generate new components, pages, and code with no usage cap.",
  "tooltips.priorityQueue":
    "Your tasks are processed faster during peak times.",
  "tooltips.whiteLabelReports":
    "Export client-ready reports with your own branding.",
  "tooltips.tokenUsage":
    "Tokens are consumed when running AI operations.",
    "tooltips.tokenPackUsage":
  "Tokens are consumed when running AI repairs, builds, or advanced operations.",
};

export function getPricingCopy(key: string): string {
  return PRICING_COPY[key] ?? key;
}
