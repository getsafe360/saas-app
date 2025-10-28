// saas-ux/navigation.ts
import {createNavigation} from 'next-intl/navigation';
import {
  locales,
  defaultLocale,
  type Locale,
  isSupportedLocale
} from '@/i18n/locales';

// Locale-aware Link/useRouter/usePathname/redirect.
// This matches your middleware (localePrefix 'as-needed').
export const {Link, redirect, usePathname, useRouter} = createNavigation({
  locales,
  defaultLocale
});

/**
 * Build a locale-prefixed path that respects 'as-needed':
 * - defaultLocale => no prefix (e.g., '/pricing')
 * - others        => '/{locale}/pricing'
 */
export function withLocale(path: string, locale: Locale): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return locale === defaultLocale ? p : `/${locale}${p}`;
}

/**
 * Strip a leading locale segment from a URL pathname, if present.
 * Useful when you need the "bare" path for matching or redirects.
 */
export function stripLocalePrefix(pathname: string): {locale: Locale; pathname: string} {
  const parts = pathname.split('/').filter(Boolean);
  const maybeLocale = parts[0];

  if (maybeLocale && isSupportedLocale(maybeLocale)) {
    const bare = '/' + parts.slice(1).join('/');
    return {locale: maybeLocale as Locale, pathname: bare || '/'};
  }
  return {locale: defaultLocale, pathname};
}
