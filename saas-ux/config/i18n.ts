// /config/i18n.ts
export const locales = ['en','de','fr','es','pt','it'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'en';
