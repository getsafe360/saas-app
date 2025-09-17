// saas-ux/navigation.ts
import {createNavigation} from 'next-intl/navigation';

export const locales = ['en', 'de', 'es', 'fr', 'it', 'pt'] as const;
export const defaultLocale = 'en';

export const {Link, redirect, usePathname, useRouter} = createNavigation({
  locales,
  defaultLocale
  // localePrefix follows your middleware ('as-needed'); no need to set it here.
});

// The above will create a <Link> component that preserves pathnames across locales