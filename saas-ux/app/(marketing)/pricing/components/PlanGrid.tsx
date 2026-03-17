import {
  PRICING_DISCLAIMERS,
  PRICING_FOOTNOTES,
  PRICING_PLANS,
  type BillingCycle,
} from "@/config/plans.config";

import PlanCard from "./PlanCard";

export default function PlanGrid({ billingCycle }: { billingCycle: BillingCycle }) {
  return (
    <section className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="grid gap-6 md:grid-cols-3">
        {PRICING_PLANS.map((plan) => (
          <PlanCard key={plan.name} {...plan} billingCycle={billingCycle} />
        ))}
      </div>

      <div className="mt-8 space-y-2 text-sm text-neutral-400">
        {PRICING_FOOTNOTES.map((footnote) => (
          <p key={footnote}>• {footnote}</p>
        ))}
      </div>
      <div className="mt-4 space-y-1 text-xs text-neutral-500">
        {PRICING_DISCLAIMERS.map((disclaimer) => (
          <p key={disclaimer}>{disclaimer}</p>
        ))}
      </div>
    </section>
  );
}
