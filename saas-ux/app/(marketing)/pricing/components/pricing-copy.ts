"use client";

import { usePathname } from "next/navigation";

import { locales, defaultLocale, type Locale } from "@/config/i18n";

import dePricing from "@/locales/de/pricing.json";
import enPricing from "@/locales/en/pricing.json";
import esPricing from "@/locales/es/pricing.json";
import frPricing from "@/locales/fr/pricing.json";
import itPricing from "@/locales/it/pricing.json";
import ptPricing from "@/locales/pt/pricing.json";

type PricingMessages = Record<string, unknown>;

const PRICING_BY_LOCALE: Record<Locale, PricingMessages> = {
  en: enPricing,
  de: dePricing,
  fr: frPricing,
  es: esPricing,
  it: itPricing,
  pt: ptPricing,
};

function resolveLocaleFromPath(pathname: string): Locale {
  const segment = pathname.split("/").filter(Boolean)[0];
  return locales.includes(segment as Locale) ? (segment as Locale) : defaultLocale;
}

function getValueByKey(messages: PricingMessages, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((current, part) => {
      if (current && typeof current === "object" && part in current) {
        return (current as Record<string, unknown>)[part];
      }
      return undefined;
    }, messages);

  return typeof value === "string" ? value : key;
}

export function usePricingCopy() {
  const pathname = usePathname();
  const locale = resolveLocaleFromPath(pathname || "/");
  const messages = PRICING_BY_LOCALE[locale] ?? PRICING_BY_LOCALE[defaultLocale];

  return (key: string) => getValueByKey(messages, key);
}
