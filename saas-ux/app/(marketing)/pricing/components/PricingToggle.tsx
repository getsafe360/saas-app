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
      <div className="inline-flex items-center gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--card-bg)] p-3 text-sm text-[var(--text-subtle)] transition-colors duration-300">
        <span className={billingCycle === "monthly" ? "text-[var(--text-default)]" : ""}>{t("billing.monthly")}</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={t("billing.toggleAria")}
          className="relative h-7 w-14 rounded-full border border-[var(--border-default)] bg-[var(--color-neutral-200)] p-1 transition-colors duration-300"
        >
          <span
            className={`block h-5 w-5 rounded-full bg-[var(--text-default)] transition-transform duration-300 ${
              billingCycle === "yearly" ? "translate-x-7" : "translate-x-0"
            }`}
          />
        </button>
        <span className={billingCycle === "yearly" ? "text-[var(--text-default)]" : ""}>
          {t("billing.yearly")} <span className="text-emerald-500 dark:text-emerald-300">({t("billing.save")})</span>
        </span>
      </div>
    </section>
  );
}
