import { headers } from "next/headers";

import PricingPage from "@/app/(marketing)/pricing/page";
import { PricingCurrencyProvider } from "@/components/pricing/currency-context";
import { currencyForCountry } from "@/config/billing/currency";

// This is the page actually served at /pricing (the (marketing) copy is not
// routed under [locale]), so the currency provider must wrap it here. The
// country header is set by Vercel at the edge; reading it server-side means the
// first paint is already local, with no euro flash.
export default async function LocalizedPricingPage() {
  const country = (await headers()).get("x-vercel-ip-country");
  return (
    <PricingCurrencyProvider currency={currencyForCountry(country)}>
      <PricingPage />
    </PricingCurrencyProvider>
  );
}
