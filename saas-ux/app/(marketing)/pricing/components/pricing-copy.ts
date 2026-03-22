"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { defaultLocale, locales, type Locale } from "@/config/i18n";
import enPricing from "@/locales/en/pricing.json";

type PricingMessages = Record<string, unknown>;

type PricingTranslator = (key: string) => string;

const PRICING_LOADERS: Record<Locale, () => Promise<PricingMessages>> = {
  en: () => import("@/locales/en/pricing.json").then((mod) => mod.default),
  de: () => import("@/locales/de/pricing.json").then((mod) => mod.default),
  fr: () => import("@/locales/fr/pricing.json").then((mod) => mod.default),
  es: () => import("@/locales/es/pricing.json").then((mod) => mod.default),
  it: () => import("@/locales/it/pricing.json").then((mod) => mod.default),
  pt: () => import("@/locales/pt/pricing.json").then((mod) => mod.default),
};

const messageCache = new Map<Locale, PricingMessages>([["en", enPricing as PricingMessages]]);

function resolveLocaleFromPath(pathname: string): Locale {
  const segment = pathname.split("/").filter(Boolean)[0];
  return locales.includes(segment as Locale)
    ? (segment as Locale)
    : defaultLocale;
}

function getValueByKey(messages: PricingMessages, key: string): string {
  const value = key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }

    return undefined;
  }, messages);

  return typeof value === "string" ? value : key;
}

export function usePricingCopy(): PricingTranslator {
  const pathname = usePathname();
  const locale = useMemo(
    () => resolveLocaleFromPath(pathname ?? "/"),
    [pathname],
  );
  const [messages, setMessages] = useState<PricingMessages | null>(() => {
    if (messageCache.has(locale)) {
      return messageCache.get(locale) ?? null;
    }

    return messageCache.get(defaultLocale) ?? null;
  });

  useEffect(() => {
    let isMounted = true;

    if (messageCache.has(locale)) {
      setMessages(messageCache.get(locale) ?? null);
      return () => {
        isMounted = false;
      };
    }

    void PRICING_LOADERS[locale]().then((loadedMessages) => {
      if (!isMounted) {
        return;
      }

      messageCache.set(locale, loadedMessages);
      setMessages(loadedMessages);
    });

    return () => {
      isMounted = false;
    };
  }, [locale]);

  return (key: string) => {
    if (!messages) {
      return key;
    }

    return getValueByKey(messages, key);
  };
}
