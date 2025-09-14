export const LOCALES = ['en','de','es','fr','it','pt'] as const;
export type Locale = typeof LOCALES[number];

export function normalizeLocale(l?: string | null): Locale {
  const n = (l || '').toLowerCase();
  const base = n.split('-')[0];
  return (LOCALES as readonly string[]).includes(base) ? (base as Locale) : 'en';
}
