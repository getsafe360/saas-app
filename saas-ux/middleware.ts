// saas-ux/middleware.ts
import {clerkMiddleware} from '@clerk/nextjs/server';
import createIntlMiddleware from 'next-intl/middleware';
import {locales, defaultLocale} from './config/i18n';
import {NextResponse} from 'next/server';

const intl = createIntlMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,
  localePrefix: 'always' // or 'as-needed'
});

export default clerkMiddleware((auth, req) => {
  const {pathname} = req.nextUrl;

  // 1) Skip i18n for API/static
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/trpc') ||
    pathname.startsWith('/_next') ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2) (Optional) Keep Clerk UI pages unlocalized
  if (
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/sso-callback')
  ) {
    return NextResponse.next();
  }

  // 3) App pages → next-intl handles detection/rewrites
  return intl(req);
});

export const config = {
  matcher: [
    // App routes (exclude Next internals & files)
    '/((?!_next|.*\\..*).*)',
    // Also run on API & tRPC for Clerk auth (i18n will early-return above)
    '/(api|trpc)(.*)'
  ]
};
