"use client";

import { TOKEN_PACKS } from "@/config/plans.config";
import { useStartCheckout } from "@/hooks/useStartCheckout";
import { OUTLINE_BUTTON } from "./button-styles";
import { useCurrency } from "@/components/pricing/currency-context";
import { PACK_AMOUNTS, formatPrice } from "@/config/billing/currency";

import {
  MICROCOPY_TOOLTIPS,
  MicrocopyTooltip,
} from "./MicrocopyTooltips";
import { usePricingCopy } from "./pricing-copy";

export default function TokenPacks() {
  const t = usePricingCopy();
  const { start, loading, error } = useStartCheckout("/pricing");
  const currency = useCurrency();
  return (
    <section className="mx-auto mt-16 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-semibold text-[var(--text-default)]">{t("tokenPacks.title")}</h2>
        <p className="mt-2 text-[var(--text-subtle)]">
          {t("tokenPacks.description")}
          <MicrocopyTooltip text={t(MICROCOPY_TOOLTIPS.tokenPackUsage)} />
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-center text-sm text-red-500">
          {error}
        </p>
      )}
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
            <p className="mt-4 text-3xl font-semibold text-[var(--text-default)]">{formatPrice(PACK_AMOUNTS[pack.slug][currency], currency)}</p>

            <button
              type="button"
              disabled={loading}
              onClick={() => start({ kind: "pack", pack: pack.slug })}
              className={OUTLINE_BUTTON}
            >
              {t("tokenPacks.button")}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
