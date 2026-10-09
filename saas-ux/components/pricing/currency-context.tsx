'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import { currencyForCountry, DEFAULT_CURRENCY, type Currency } from '@/config/billing/currency';

const CurrencyContext = createContext<Currency>(DEFAULT_CURRENCY);

/**
 * Provides the visitor's local currency, decided on the server from their
 * country. `?country=SG` overrides the DISPLAY only (to preview other regions);
 * checkout always charges in the currency the server derives from the real IP.
 */
export function PricingCurrencyProvider({
  currency,
  children,
}: {
  currency: Currency;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState<Currency>(currency);

  useEffect(() => {
    const override = new URLSearchParams(window.location.search).get('country');
    if (override) setShown(currencyForCountry(override));
  }, []);

  return <CurrencyContext.Provider value={shown}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): Currency {
  return useContext(CurrencyContext);
}
