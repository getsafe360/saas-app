"use client";

import type { BillingCycle } from "@/config/plans.config";
import { usePricingCopy } from "./pricing-copy";

interface PricingToggleProps {
  billingCycle: BillingCycle;
  onToggle: () => void;
}

export default function PricingToggle({
  billingCycle,
  onToggle,
}: PricingToggleProps) {
  const t = usePricingCopy();
  return (
    <section className="mx-auto mt-10 flex w-full max-w-6xl justify-center px-4 sm:px-6 lg:px-8">
      <div className="inline-flex items-center gap-4 rounded-xl border border-slate-700/70 bg-white/[0.03] p-3 text-sm text-slate-300">
        <span className={billingCycle === "monthly" ? "text-slate-100" : ""}>{t("billing.monthly")}</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={t("billing.toggleAria")}
          className="relative h-7 w-14 rounded-full border border-slate-600 bg-slate-800 p-1 transition-colors duration-300"
        >
          <span
            className={`block h-5 w-5 rounded-full bg-slate-100 transition-transform duration-300 ${
              billingCycle === "yearly" ? "translate-x-7" : "translate-x-0"
            }`}
          />
        </button>
        <span className={billingCycle === "yearly" ? "text-slate-100" : ""}>
          {t("billing.yearly")} <span className="text-emerald-300">({t("billing.save")})</span>
        </span>
      </div>
    </section>
  );
}
