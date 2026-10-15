// saas-ux/i18n/resolve-locale.ts
// Server-side locale detection
import 'server-only';
import { cookies, headers } from 'next/headers';
import {
  normalizeLocale,
  isSupportedLocale,
  pickLocaleFromAcceptLanguage,
  DEFAULT_LOCALE,
  type Locale,
} from './locales';
import { getUser } from '@/lib/db/queries';

// Extend the inferred return with an optional language field
type MaybeUserWithLang = Awaited<ReturnType<typeof getUser>> & {
  language?: string | null;
};

export async function resolveLocale(): Promise<string> {
  const user = (await getUser()) as MaybeUserWithLang;
  if (user && typeof user.language === 'string' && user.language) {
    return normalizeLocale(user.language);
  }

  const cookieStore = await cookies();
  const cookie = cookieStore.get('NEXT_LOCALE')?.value;
  if (cookie) return normalizeLocale(cookie);

  const headersList = await headers();
  const accept = headersList.get('accept-language') || '';
  const guess = accept.split(',')[0] || 'en';

  return normalizeLocale(guess);
}

/**
 * The visitor's language, before anyone is signed in: the NEXT_LOCALE cookie
 * (set by the language switcher and the locale middleware), then the first
 * supported entry of Accept-Language (honouring q-values), else English.
 * Safe to call outside a request: it falls back to English.
 */
export async function detectVisitorLocale(): Promise<Locale> {
  try {
    const cookie = (await cookies()).get('NEXT_LOCALE')?.value;
    if (cookie) {
      const base = cookie.toLowerCase().split('-')[0];
      if (isSupportedLocale(base)) return base;
    }

    const fromHeader = pickLocaleFromAcceptLanguage((await headers()).get('accept-language'));
    if (fromHeader) return fromHeader;
  } catch {
    // no request scope (script, cron) — fall through
  }
  return DEFAULT_LOCALE;
}
