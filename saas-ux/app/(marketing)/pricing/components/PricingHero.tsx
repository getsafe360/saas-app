"use client";

import { usePricingCopy } from "./pricing-copy";

export default function PricingHero() {
  const t = usePricingCopy();
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-16 text-center sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold tracking-tight text-slate-100 sm:text-5xl">
        {t("hero.title")}
      </h1>
      <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
        {t("hero.description")}
      </p>
    </section>
  );
}
