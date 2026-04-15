"use client";

import {
  PRICING_DISCLAIMERS,
  PRICING_FOOTNOTES,
  PRICING_PLANS,
  type BillingCycle,
} from "@/config/plans.config";

import PlanCard from "./PlanCard";
import { usePricingCopy } from "./pricing-copy";

export default function PlanGrid({ billingCycle }: { billingCycle: BillingCycle }) {
  const t = usePricingCopy();
  return (
    <section className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="grid gap-6 md:grid-cols-3">
        {PRICING_PLANS.map((plan) => {
          const { type, ...rest } = plan;
          return <PlanCard key={type} type={type} {...rest} billingCycle={billingCycle} />;
        })}
      </div>

      <div className="mt-8 space-y-2 text-sm text-[var(--text-subtle)]">
        {PRICING_FOOTNOTES.map((footnote) => (
          <p key={footnote}>• {t(footnote)}</p>
        ))}
      </div>
      <div className="mt-4 space-y-1 text-xs text-[var(--text-subtle)] opacity-70">
        {PRICING_DISCLAIMERS.map((disclaimer) => (
          <p key={disclaimer}>{t(disclaimer)}</p>
        ))}
      </div>
    </section>
  );
}
