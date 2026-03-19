const PRICING_COPY: Record<string, string> = {
  "hero.title": "Plans & Pricing",
  "hero.description":
    "Choose the plan that matches your workflow, then scale with flexible token packs whenever your team needs extra AI throughput.",
  "billing.monthly": "Monthly",
  "billing.yearly": "Yearly",
  "billing.save": "save 2 months",
  "billing.toggleAria": "Toggle billing cycle",
  "labels.perMonth": "/month",
  "labels.perYear": "/year",
  "labels.bestFor": "Best for:",
  "labels.custom": "Custom",
  "plans.payg.name": "Pay-as-you-go",
  "plans.payg.description":
    "Our most flexible option for webmasters and small teams. Pay only for the fixes and analyses you need — perfect for emerging sites or occasional maintenance without a monthly commitment.",
  "plans.payg.bestFor": "Webmasters, small teams, and new projects.",
  "plans.payg.cta": "Start Pay-as-you-go",
  "plans.payg.features.analysis": "Access to all analysis tools",
  "plans.payg.features.repairs": "On-demand AI repairs (token-based)",
  "plans.payg.features.noMonthlyFees": "No monthly fees",
  "plans.payg.features.lowFrequency": "Ideal for low-frequency usage",
  "plans.pro.name": "Pro",
  "plans.pro.description":
    "Unlimited AI repairs, builds, and analysis tools. Ideal for developers, freelancers, and organizations managing one or more sites. Full power without limits.",
  "plans.pro.bestFor": "Developers, freelancers, and growing organizations.",
  "plans.pro.cta": "Start Pro Plan",
  "plans.pro.features.unlimitedRepairs": "Unlimited AI repairs",
  "plans.pro.features.unlimitedBuilds": "Unlimited builds",
  "plans.pro.features.fullSuite": "Full site analysis suite",
  "plans.pro.features.multiSite": "Multi-site support",
  "plans.pro.features.priorityQueue": "Priority queue",
  "plans.agency.name": "Agency",
  "plans.agency.description":
    "Built for agencies and professionals managing multiple client sites. Includes client-ready white-label reports, priority processing, and advanced collaboration features.",
  "plans.agency.bestFor":
    "Agencies, studios, and professionals managing multiple client sites.",
  "plans.agency.cta": "Start Agency Plan",
  "plans.agency.features.everythingInPro": "Everything in Pro",
  "plans.agency.features.whiteLabelReports": "White-label client reports",
  "plans.agency.features.priorityProcessing": "Priority processing",
  "plans.agency.features.teamCollaboration": "Team collaboration features",
  "plans.agency.features.multiClient": "Multi-client management",
  "tokenPacks.title": "Token Packs",
  "tokenPacks.description":
    "Buy tokens on demand and keep AI operations moving with no subscription lock-in.",
  "tokenPacks.button": "Buy tokens",
  "tokenPacks.items.small": "Small",
  "tokenPacks.items.medium": "Medium",
  "tokenPacks.items.large": "Large",
  "footnotes.saveTwoMonths": "Annual billing saves you 2 months.",
  "footnotes.fairUse": "Unlimited usage is subject to fair-use guidelines.",
  "footnotes.tokenVaries": "Token consumption varies by operation complexity.",
  "disclaimers.cancelAnytime": "Cancel anytime. No hidden fees.",
  "disclaimers.excludeVat": "Prices exclude VAT where applicable.",
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
  "tooltips.unlimitedRepairs":
    "Unlimited repairs: Run as many AI fixes as you need without limits.",
  "tooltips.unlimitedBuilds":
    "Unlimited builds: Generate new components, pages, and code with no usage cap.",
  "tooltips.priorityQueue":
    "Priority queue: Your tasks are processed faster during peak times.",
  "tooltips.whiteLabelReports":
    "White-label reports: Export client-ready reports with your own branding.",
  "tooltips.tokenUsage":
    "Token usage: Tokens are consumed when running AI operations.",
  "tooltips.tokenPackUsage":
    "Tokens are consumed when running AI repairs, builds, or advanced analyses.",
};

export function getPricingCopy(key: string): string {
  return PRICING_COPY[key] ?? key;
}
