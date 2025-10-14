// lib/server/pricingPageResolver.ts
import { asc, and, eq, inArray } from "drizzle-orm";
import {
  supportedLocales,
  paymentMethods, paymentMethodTranslations, regionPaymentMethods,
  taxDisplayPolicies,
} from "@/lib/db/schema";
import { getPricingView } from "@/lib/server/pricingResolver"; // the one we built earlier
import { db } from "@/lib/db";

type PaymentLogo = { code: string; name: string; iconHint?: string | null };
type TaxFootnote = { key: string; text: string }; // small string, localize in UI if you prefer
type Badge = { label: string; tooltip?: string };

export async function getPricingPageView(opts: {
  locale?: string;         // 'de','en','pt-BR',...
  currency?: string;       // 'EUR','USD','BRL'
  region?: string | null;  // 'DE','US','BR','AU','NZ', ...
  isBusiness?: boolean;    // to decide VAT-ID / reverse-charge hint
}) {
  const locale = (opts.locale ?? "en").toLowerCase();
  const currency = (opts.currency ?? "EUR").toUpperCase();
  const region = opts.region ?? null;
  const isBusiness = !!opts.isBusiness;

  // 1) Base pricing data (plans, addOns, tax meta)
  const base = await getPricingView({ locale, currency, region });

  // 2) Payment methods (region-aware with i18n names)
  let logos: PaymentLogo[] = [];
  if (region) {
    const rpms = await db.select().from(regionPaymentMethods)
      .where(and(eq(regionPaymentMethods.region, region), eq(regionPaymentMethods.enabled, true)))
      .orderBy(asc(regionPaymentMethods.priority));
    const codes = rpms.map(r => r.methodCode);
    const methods = codes.length
      ? await db.select().from(paymentMethods).where(inArray(paymentMethods.code, codes))
      : [];
    const names = await db.select().from(paymentMethodTranslations)
      .where(and(inArray(paymentMethodTranslations.methodCode, codes), eq(paymentMethodTranslations.locale, locale)));
    logos = methods.map(m => {
      const n = names.find(x => x.methodCode === m.code);
      return { code: m.code, name: n?.name ?? pretty(m.code), iconHint: m.iconHint };
    });
  }

  // 3) Tax display policy
  const policy = region
    ? await db.select().from(taxDisplayPolicies).where(eq(taxDisplayPolicies.country, region)).limit(1)
    : [];
  const p = policy[0];

  // 4) Badges (simple examples; tune per region)
  const badges: Badge[] = [];
  if (region && ["DE","FR","ES","IT","PT"].includes(region)) {
    badges.push({ label: "EU-hosted", tooltip: "Data hosted in the EU." });
    badges.push({ label: "GDPR-ready", tooltip: "Compliance pack checks common GDPR items." });
  }
  if (region === "US") badges.push({ label: "US-friendly", tooltip: "ACH and cards supported." });
  if (region === "BR") badges.push({ label: "Brasil pronto", tooltip: "Pix e Boleto disponíveis." });
  if (region === "AU" || region === "NZ") badges.push({ label: "Oceania", tooltip: "Local cards & wallets supported." });

  // 5) Footnotes (short, UI-safe; localize with your messages/*.json if you prefer)
  const footnotes: TaxFootnote[] = [];
  if (p) {
    if (p.taxLabel === "vat_included") {
      footnotes.push({ key: "vat_included", text: "Prices include VAT where applicable." });
      if (isBusiness && p.reverseChargeEligible) {
        footnotes.push({ key: "reverse_charge", text: "Enter a valid VAT ID for reverse charge (B2B)." });
      }
    } else if (p.taxLabel === "tax_added") {
      footnotes.push({ key: "tax_added", text: "Taxes are calculated at checkout." });
    } else {
      footnotes.push({ key: "tax_may_apply", text: "Taxes may apply depending on your location." });
    }
    if (region === "BR" && p.collectNationalId) {
      footnotes.push({ key: "cpf_cnpj", text: "Informe CPF/CNPJ para emissão da nota fiscal." });
    }
  } else {
    footnotes.push({ key: "tax_may_apply", text: "Taxes may apply depending on your location." });
  }

  // 6) Section titles (route through your i18n layer)
  const sections = {
    plansTitle: "Plans",
    addOnsTitle: "Add-ons",
    paymentsTitle: "Payment methods",
  };

  return {
    locale: base.locale,
    currency: base.currency,
    region: base.region,
    sections,
    badges,
    plans: base.plans,     // already localized + priced
    addOns: base.addOns,   // already localized + priced
    payments: { logos },   // render icons using iconHint/code
    footnotes,             // render as small list under grid
    meta: base.meta,       // includes taxPolicy hint
  };
}

function pretty(code: string) {
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
