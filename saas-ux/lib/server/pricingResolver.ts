// lib/server/pricingPageResolver.ts
import 'server-only';
import { getPricingPageView as getPricingBaseView } from '@/lib/server/pricingResolver';
import { listPaymentMethodsForRegion, getTaxPolicyForCountry } from '@/lib/db/queries';

type PaymentLogo = { code: string; name: string; iconHint?: string | null };
type TaxFootnote = { key: string; text: string };
type Badge = { label: string; tooltip?: string };

// If your pricingResolver exports a type, import it instead.
// For now, declare the minimal shape it returns:
type BasePricingView = {
  locale: string;
  currency: string;
  region: string | null;
  plans: unknown[];    // replace with your concrete plan type if available
  addOns: unknown[];   // replace with your concrete add-on type if available
  meta?: unknown;
};

// The final return type of THIS resolver:
export type PricingPageView = {
  locale: string;
  currency: string;
  region: string | null;
  sections: {
    plansTitle: string;
    addOnsTitle: string;
    paymentsTitle: string;
  };
  badges: Badge[];
  plans: unknown[];
  addOns: unknown[];
  payments: { logos: PaymentLogo[] };
  footnotes: TaxFootnote[];
  meta?: unknown;
};

export async function getPricingPageView(opts: {
  locale?: string;         // 'de','en','pt-BR',...
  currency?: string;       // 'EUR','USD','BRL'
  region?: string | null;  // 'DE','US','BR','AU','NZ', ...
  isBusiness?: boolean;    // to decide VAT-ID / reverse-charge hint
}): Promise<PricingPageView> {
  const locale = (opts.locale ?? 'en').toLowerCase();
  const currency = (opts.currency ?? 'EUR').toUpperCase();
  const region = opts.region ?? null;
  const isBusiness = !!opts.isBusiness;

  // 1) Base pricing data (already localized + priced)
  const base: BasePricingView = (await getPricingBaseView({
    locale,
    currency,
    region,
  })) as BasePricingView;

  // 2) Payment methods (region-aware with i18n names)
  let logos: PaymentLogo[] = [];
  if (region) {
    const methods = await listPaymentMethodsForRegion({ regionCode: region, locale });
    const enabled = methods.filter((m) => m.enabled).sort((a, b) => a.priority - b.priority);
    logos = enabled.map((m) => ({
      code: m.code,
      name: m.label,
      iconHint: m.iconHint ?? null,
    }));
  }

  // 3) Tax display policy
  const policy = region ? await getTaxPolicyForCountry(region) : null;

  // 4) Badges (simple examples; tune per region)
  const badges: Badge[] = [];
  if (region && ['DE', 'FR', 'ES', 'IT', 'PT'].includes(region)) {
    badges.push({ label: 'EU-hosted', tooltip: 'Data hosted in the EU.' });
    badges.push({ label: 'GDPR-ready', tooltip: 'Compliance pack checks common GDPR items.' });
  }
  if (region === 'US') badges.push({ label: 'US-friendly', tooltip: 'ACH and cards supported.' });
  if (region === 'BR') badges.push({ label: 'Brasil pronto', tooltip: 'Pix e Boleto disponíveis.' });
  if (region === 'AU' || region === 'NZ') badges.push({ label: 'Oceania', tooltip: 'Local cards & wallets supported.' });

  // 5) Footnotes
  const footnotes: TaxFootnote[] = [];
  if (policy) {
    if (policy.taxLabel === 'vat_included') {
      footnotes.push({ key: 'vat_included', text: 'Prices include VAT where applicable.' });
      if (isBusiness && policy.reverseChargeEligible) {
        footnotes.push({ key: 'reverse_charge', text: 'Enter a valid VAT ID for reverse charge (B2B).' });
      }
    } else if (policy.taxLabel === 'tax_added') {
      footnotes.push({ key: 'tax_added', text: 'Taxes are calculated at checkout.' });
    } else {
      footnotes.push({ key: 'tax_may_apply', text: 'Taxes may apply depending on your location.' });
    }
    if (region === 'BR' && policy.collectNationalId) {
      footnotes.push({ key: 'cpf_cnpj', text: 'Informe CPF/CNPJ para emissão da nota fiscal.' });
    }
  } else {
    footnotes.push({ key: 'tax_may_apply', text: 'Taxes may apply depending on your location.' });
  }

  // 6) Section titles (route through your i18n layer if needed)
  const sections = {
    plansTitle: 'Plans',
    addOnsTitle: 'Add-ons',
    paymentsTitle: 'Payment methods',
  };

  return {
    locale: base.locale,
    currency: base.currency,
    region: base.region,
    sections,
    badges,
    plans: base.plans,
    addOns: base.addOns,
    payments: { logos },
    footnotes,
    meta: base.meta,
  };
}
