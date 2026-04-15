"use client";

import { PRICING_FAQ } from "@/config/plans.config";
import { usePricingCopy } from "./pricing-copy";

export default function FaqSection() {
  const t = usePricingCopy();
  return (
    <section className="mx-auto mt-16 w-full max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
      <h2 className="text-center text-3xl font-semibold text-[var(--text-default)]">{t("faq.title")}</h2>

      <div className="mt-8 space-y-3">
        {PRICING_FAQ.map((item) => (
          <details
            key={item.questionKey}
            className="group rounded-xl border border-[var(--border-default)] bg-[var(--card-bg)] p-5 transition-colors duration-200"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between text-base font-medium text-[var(--text-default)]">
              {t(item.questionKey)}
              <span
                className="ml-4 grid size-6 place-items-center rounded-md text-[var(--text-subtle)] ring-1 ring-[var(--border-default)] transition-transform duration-300 group-open:rotate-180"
                aria-hidden
              >
                ▾
              </span>
            </summary>
            <div className="grid grid-rows-[0fr] transition-all duration-300 ease-out group-open:grid-rows-[1fr]">
              <div className="overflow-hidden">
                <p className="pt-3 text-sm leading-relaxed text-[var(--text-subtle)]">{t(item.answerKey)}</p>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
