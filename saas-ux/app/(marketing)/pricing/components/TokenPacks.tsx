"use client";

import { TOKEN_PACKS } from "@/config/plans.config";

import {
  MICROCOPY_TOOLTIPS,
  MicrocopyTooltip,
} from "./MicrocopyTooltips";
import { usePricingCopy } from "./pricing-copy";

export default function TokenPacks() {
  const t = usePricingCopy();
  return (
    <section className="mx-auto mt-16 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-semibold text-slate-100">{t("tokenPacks.title")}</h2>
        <p className="mt-2 text-slate-300">
          {t("tokenPacks.description")}
          <MicrocopyTooltip text={t(MICROCOPY_TOOLTIPS.tokenPackUsage)} />
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {TOKEN_PACKS.map((pack) => (
          <article
            key={pack.nameKey}
            className="rounded-xl border border-slate-700/70 bg-white/[0.03] p-6 shadow-sm transition-colors duration-200 hover:border-slate-500/70 md:p-8"
          >
            <h3 className="text-xl font-semibold text-slate-100">{t(pack.nameKey)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {t(pack.descriptionKey)}
            </p>
            <p className="mt-4 text-3xl font-semibold text-slate-100">{pack.price}</p>

            <a
              href={pack.stripeUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center rounded-md border border-slate-500/70 bg-slate-900/40 px-4 py-2.5 text-base font-medium text-slate-100 transition-colors duration-200 hover:bg-slate-800/60"
            >
              {t("tokenPacks.button")}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
