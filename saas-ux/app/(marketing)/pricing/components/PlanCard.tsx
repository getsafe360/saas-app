"use client";

import { useClerk } from "@clerk/nextjs";
import { CheckCircle2 } from "lucide-react";

import type { BillingCycle } from "@/config/plans.config";

import { MICROCOPY_TOOLTIPS, MicrocopyTooltip } from "./MicrocopyTooltips";

interface PlanCardProps {
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
  billingCycle: BillingCycle;
}

const FEATURE_TOOLTIP_MAP: Record<string, string> = {
  "Unlimited AI repairs": MICROCOPY_TOOLTIPS.unlimitedRepairs,
  "Unlimited builds": MICROCOPY_TOOLTIPS.unlimitedBuilds,
  "Priority queue": MICROCOPY_TOOLTIPS.priorityQueue,
  "White-label client reports": MICROCOPY_TOOLTIPS.whiteLabelReports,
  "On-demand AI repairs (token-based)": MICROCOPY_TOOLTIPS.tokenUsage,
};

export default function PlanCard({
  name,
  description,
  priceMonthly,
  priceYearly,
  features,
  bestFor,
  stripeUrl,
  borderColorToken,
  type,
  ctaLabel,
  billingCycle,
}: PlanCardProps) {
  const { openSignIn } = useClerk();

  const displayPrice = billingCycle === "monthly" ? priceMonthly : priceYearly;
  const suffix = billingCycle === "monthly" ? "/month" : "/year";

  return (
    <article
      className="group rounded-xl border border-neutral-700 bg-[#1b1b1b] p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg md:p-8"
      style={{ borderTop: `3px solid ${borderColorToken}` }}
    >
      <h3 className="text-2xl font-semibold text-white">{name}</h3>
      <p className="mt-3 text-sm leading-relaxed text-neutral-300">{description}</p>

      <p className="mt-6 text-3xl font-semibold text-white">
        €{displayPrice} <span className="text-base font-normal text-neutral-400">{suffix}</span>
      </p>

      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-neutral-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary-300" />
            <span>
              {feature}
              {FEATURE_TOOLTIP_MAP[feature] && (
                <MicrocopyTooltip text={FEATURE_TOOLTIP_MAP[feature]} />
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm text-neutral-400">
        <span className="font-medium text-neutral-200">Best for:</span> {bestFor}
      </p>

      {type === "free" ? (
        <button
          type="button"
          onClick={() => openSignIn?.()}
          className="mt-6 w-full bg-surface-primary border border-border-primary rounded-md px-4 py-2.5 text-base font-medium text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:bg-surface-primaryHover"
        >
          {ctaLabel}
        </button>
      ) : (
        <a
          href={stripeUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex w-full items-center justify-center bg-surface-primary border border-border-primary rounded-md px-4 py-2.5 text-base font-medium text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:bg-surface-primaryHover"
        >
          {ctaLabel}
        </a>
      )}
    </article>
  );
}
