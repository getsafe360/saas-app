// saas-ux/middleware.ts
import {clerkMiddleware} from '@clerk/nextjs/server';
import createIntlMiddleware from 'next-intl/middleware';
import {NextResponse} from 'next/server';

const locales = ['en','de','es','fr','it','pt'] as const;

const intl = createIntlMiddleware({
  locales,
  defaultLocale: 'en',
  localePrefix: 'as-needed' // always or 'as-needed' if you don't want /en/ prefix
});

// Combine: run Clerk, then delegate routing to next-intl where appropriate.
export default clerkMiddleware((auth, req) => {
  const {pathname} = req.nextUrl;

  // 1) Never run i18n on API or static assets
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/trpc') ||
    pathname.startsWith('/_next') ||
    /\.[^/]+$/.test(pathname) // any file with an extension
  ) {
    return NextResponse.next();
  }

  // 2) For all app pages, let next-intl handle locale detection/rewrites
  return intl(req);
});

// Match both app pages and APIs (Clerk for both; next-intl will early-return for APIs)
export const config = {
  matcher: [
    // App routes (exclude Next internals & files)
    '/((?!_next|.*\\..*).*)',
    // Always run on API and tRPC for Clerk (but we won't apply next-intl there)
    '/(api|trpc)(.*)'
  ]
};
