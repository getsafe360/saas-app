"use client";

import { PRICING_FAQ } from "@/config/plans.config";
import { usePricingCopy } from "./pricing-copy";

export default function FaqSection() {
  const t = usePricingCopy();
  return (
    <section className="mx-auto mt-16 w-full max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
      <h2 className="text-center text-3xl font-semibold text-slate-100">{t("faq.title")}</h2>

      <div className="mt-8 space-y-3">
        {PRICING_FAQ.map((item) => (
          <details
            key={item.questionKey}
            className="group rounded-xl border border-slate-700/70 bg-white/[0.03] p-5"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between text-base font-medium text-slate-100">
              {t(item.questionKey)}
              <span
                className="ml-4 grid size-6 place-items-center rounded-md text-slate-500 ring-1 ring-slate-700 transition-transform duration-300 group-open:rotate-180"
                aria-hidden
              >
                ▾
              </span>
            </summary>
            <div className="grid grid-rows-[0fr] transition-all duration-300 ease-out group-open:grid-rows-[1fr]">
              <div className="overflow-hidden">
                <p className="pt-3 text-sm leading-relaxed text-slate-300">{t(item.answerKey)}</p>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
