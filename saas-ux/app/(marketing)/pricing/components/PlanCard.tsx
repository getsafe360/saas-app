"use client";

import { useClerk } from "@clerk/nextjs";
import { Check, Code2, Coins, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import type { BillingCycle } from "@/config/plans.config";

import { MICROCOPY_TOOLTIPS, MicrocopyTooltip } from "./MicrocopyTooltips";
import { getPricingCopy } from "./pricing-copy";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

interface PlanCardProps {
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
  billingCycle: BillingCycle;
}

const FEATURE_TOOLTIP_MAP: Record<string, string> = {
  "plans.pro.features.unlimitedRepairs": MICROCOPY_TOOLTIPS.unlimitedRepairs,
  "plans.pro.features.unlimitedBuilds": MICROCOPY_TOOLTIPS.unlimitedBuilds,
  "plans.agency.features.priorityProcessing": MICROCOPY_TOOLTIPS.priorityQueue,
  "plans.agency.features.whiteLabelReports":
    MICROCOPY_TOOLTIPS.whiteLabelReports,
  "plans.payg.features.tokenUsage": MICROCOPY_TOOLTIPS.tokenUsage,
};

export default function PlanCard({
  nameKey,
  descriptionKey,
  priceMonthly,
  priceYearly,
  features,
  bestForKey,
  stripeUrl,
  borderColorToken,
  type,
  ctaLabelKey,
  billingCycle,
}: PlanCardProps) {
  const { openSignIn } = useClerk();
  const [isPriceVisible, setIsPriceVisible] = useState(true);

  const targetPrice = billingCycle === "monthly" ? priceMonthly : priceYearly;
  const animatedPrice = useAnimatedNumber(targetPrice);

  const suffix =
    billingCycle === "monthly"
      ? getPricingCopy("labels.perMonth")
      : getPricingCopy("labels.perYear");
  const isCustomPrice = priceMonthly === 0 && priceYearly === 0;

  useEffect(() => {
    // Phase 1: scale down + fade out
    setIsPriceVisible(false);

    const timeoutId = setTimeout(() => {
      // Phase 2: scale up + fade in
      setIsPriceVisible(true);
    }, 180); // 150–200ms is ideal

    return () => clearTimeout(timeoutId);
  }, [billingCycle]);

  const iconStyles =
    type === "agency"
      ? {
          wrapper:
            "from-sky-500/15 to-cyan-400/10 dark:from-sky-400/20 dark:to-cyan-400/10 ring-sky-500/20",
          icon: "text-sky-600 dark:text-sky-400",
          Icon: Sparkles,
        }
      : type === "pro"
        ? {
            wrapper:
              "from-violet-500/15 to-fuchsia-400/10 dark:from-violet-400/20 dark:to-fuchsia-400/10 ring-violet-500/20",
            icon: "text-violet-600 dark:text-violet-400",
            Icon: Code2,
          }
        : {
            wrapper:
              "from-emerald-500/15 to-teal-400/10 dark:from-emerald-400/20 dark:to-teal-400/10 ring-emerald-500/20",
            icon: "text-emerald-600 dark:text-emerald-400",
            Icon: Coins,
          };

  const Icon = iconStyles.Icon;

  return (
    <article
      className="group overflow-hidden rounded-2xl border border-slate-700/70 bg-white/[0.03] p-6 shadow-sm transition-colors duration-200 hover:border-slate-500/70 md:p-8"
      style={{ borderTop: `3px solid ${borderColorToken}` }}
    >
      <div
        className={`mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${iconStyles.wrapper}`}
      >
        <Icon className={`h-6 w-6 ${iconStyles.icon}`} />
      </div>

      <h3 className="text-2xl font-semibold text-slate-100">
        {getPricingCopy(nameKey)}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        {getPricingCopy(descriptionKey)}
      </p>

      <p className="mt-6 text-3xl font-semibold text-slate-100">
        {isCustomPrice ? (
          getPricingCopy("labels.custom")
        ) : (
          <>
            €{animatedPrice}
            <span className="ml-1 text-base font-normal text-slate-400">
              {suffix}
            </span>
          </>
        )}
      </p>

      <ul className="mt-6 space-y-3">
        {features.map((featureKey) => (
          <li
            key={featureKey}
            className="flex items-start gap-3 text-sm text-slate-200"
          >
            <Check className="mt-0.5 h-4 w-4 text-emerald-400" />
            <span>
              {getPricingCopy(featureKey)}
              {FEATURE_TOOLTIP_MAP[featureKey] && (
                <MicrocopyTooltip
                  text={getPricingCopy(FEATURE_TOOLTIP_MAP[featureKey])}
                />
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm text-slate-400">
        <span className="font-medium text-slate-200">
          {getPricingCopy("labels.bestFor")}
        </span>{" "}
        {getPricingCopy(bestForKey)}
      </p>

      {type === "free" ? (
        <button
          type="button"
          onClick={() => openSignIn?.()}
          className="mt-6 w-full rounded-md border border-slate-500/70 bg-slate-900/40 px-4 py-2.5 text-base font-medium text-slate-100 transition-colors duration-200 hover:bg-slate-800/60"
        >
          {getPricingCopy(ctaLabelKey)}
        </button>
      ) : (
        <a
          href={stripeUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex w-full items-center justify-center rounded-md border border-slate-500/70 bg-slate-900/40 px-4 py-2.5 text-base font-medium text-slate-100 transition-colors duration-200 hover:bg-slate-800/60"
        >
          {getPricingCopy(ctaLabelKey)}
        </a>
      )}
    </article>
  );
}
