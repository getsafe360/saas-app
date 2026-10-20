// lib/server/payments/locale.ts
import { locales, type Locale } from '@/config/i18n';

/** Narrow an untrusted value to one of our six UI locales (all valid Stripe locales). */
export function toSupportedLocale(value: unknown): Locale | undefined {
  return typeof value === 'string' && (locales as readonly string[]).includes(value)
    ? (value as Locale)
    : undefined;
}
