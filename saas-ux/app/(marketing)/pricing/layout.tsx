import { headers } from 'next/headers';

import { PricingCurrencyProvider } from '@/components/pricing/currency-context';
import { currencyForCountry } from '@/config/billing/currency';

// Reads the visitor's country (set by Vercel at the edge) so the first paint
// already shows their currency — no € flash.
export default async function PricingLayout({ children }: { children: React.ReactNode }) {
  const country = (await headers()).get('x-vercel-ip-country');
  return <PricingCurrencyProvider currency={currencyForCountry(country)}>{children}</PricingCurrencyProvider>;
}
