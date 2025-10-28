// saas-ux/i18n/locales.ts
export const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'] as const;
export type Locale = typeof LOCALES[number];

export const DEFAULT_LOCALE: Locale = 'en';

// Lowercase aliases for convenience (matches prior imports in your app)
export const locales = LOCALES;
export const defaultLocale = DEFAULT_LOCALE;

// App-level canonical mapping (we use 'pt' for Brazilian Portuguese content).
const CANONICAL: Record<string, Locale> = {
  en: 'en',
  de: 'de',
  es: 'es',
  fr: 'fr',
  it: 'it',
  pt: 'pt' // pt-BR default; pt-PT also normalizes to 'pt'
};

/**
 * Normalizes arbitrary locale strings to one of our app locales.
 * Examples:
 *  - "EN", "en-US"   -> "en"
 *  - "pt-BR", "pt-PT"-> "pt" (we serve Brazilian Portuguese for 'pt')
 *  - unknown         -> DEFAULT_LOCALE
 */
export function normalizeLocale(input?: string | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  const n = input.toLowerCase().trim();
  const base = n.split('-')[0]; // e.g., pt-br -> pt
  return CANONICAL[base] ?? DEFAULT_LOCALE;
}

/** Type guard */
export function isSupportedLocale(l: string): l is Locale {
  return (LOCALES as readonly string[]).includes(l);
}

/** Map app locales to Open Graph locale codes */
export function toOgLocale(locale: Locale): string {
  // Use pt_BR for Brazilian Portuguese
  const map: Record<Locale, string> = {
    en: 'en_US',
    de: 'de_DE',
    es: 'es_ES',
    fr: 'fr_FR',
    it: 'it_IT',
    pt: 'pt_BR'
  };
  return map[locale];
}

/**
 * Build an hreflang map suitable for Next metadata.alternates.languages
 * Uses '/' for default locale and '/{locale}' for others.
 */
export function buildHreflangMap(
  def: Locale = DEFAULT_LOCALE
): Record<Locale, string> {
  return locales.reduce((acc, l) => {
    acc[l] = l === def ? '/' : `/${l}`;
    return acc;
  }, {} as Record<Locale, string>);
}

/** Convenience: list of OG alternate locales excluding current */
export function ogAlternateLocales(current: Locale): string[] {
  return locales.filter(l => l !== current).map(toOgLocale);
}
