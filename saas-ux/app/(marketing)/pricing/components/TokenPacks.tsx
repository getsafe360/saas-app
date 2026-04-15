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
        <h2 className="text-3xl font-semibold text-[var(--text-default)]">{t("tokenPacks.title")}</h2>
        <p className="mt-2 text-[var(--text-subtle)]">
          {t("tokenPacks.description")}
          <MicrocopyTooltip text={t(MICROCOPY_TOOLTIPS.tokenPackUsage)} />
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {TOKEN_PACKS.map((pack) => (
          <article
            key={pack.nameKey}
            className="rounded-xl border border-[var(--border-default)] bg-[var(--card-bg)] p-6 shadow-sm transition-colors duration-200 hover:border-[var(--color-neutral-400)] md:p-8"
          >
            <h3 className="text-xl font-semibold text-[var(--text-default)]">{t(pack.nameKey)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-subtle)]">
              {t(pack.descriptionKey)}
            </p>
            <p className="mt-4 text-3xl font-semibold text-[var(--text-default)]">{pack.price}</p>

            <a
              href={pack.stripeUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--color-neutral-200)] px-4 py-2.5 text-base font-medium text-[var(--text-default)] transition-colors duration-200 hover:border-[var(--border-primary)] hover:bg-[var(--color-neutral-300)]"
            >
              {t("tokenPacks.button")}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
