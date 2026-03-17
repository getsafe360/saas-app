"use client";

import type { BillingCycle } from "@/config/plans.config";

interface PricingToggleProps {
  billingCycle: BillingCycle;
  onToggle: () => void;
}

export default function PricingToggle({
  billingCycle,
  onToggle,
}: PricingToggleProps) {
  return (
    <section className="mx-auto mt-10 flex w-full max-w-6xl justify-center px-4 sm:px-6 lg:px-8">
      <div className="inline-flex items-center gap-4 rounded-xl border border-neutral-700 bg-[#1d1d1d] p-3 text-sm text-neutral-300">
        <span className={billingCycle === "monthly" ? "text-white" : ""}>Monthly</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Toggle billing cycle"
          className="relative h-7 w-14 rounded-full border border-neutral-600 bg-neutral-800 p-1 transition"
        >
          <span
            className={`block h-5 w-5 rounded-full bg-primary transition ${
              billingCycle === "yearly" ? "translate-x-7" : "translate-x-0"
            }`}
          />
        </button>
        <span className={billingCycle === "yearly" ? "text-white" : ""}>
          Yearly <span className="text-primary-300">(save 2 months)</span>
        </span>
      </div>
    </section>
  );
}
