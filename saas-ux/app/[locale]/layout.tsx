// app/[locale]/layout.tsx
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

import { locales, defaultLocale, type Locale } from '@/config/i18n';
import { Header } from '@/components/header/header';
import { Footer } from '@/components/ui/footer';
import BackToTopButton from '@/components/ui/back-to-top-button';
import { HtmlLang } from '@/components/HtmlLang';

// Absolute base for OG/canonical
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.getsafe360.com';
const OG_IMAGE = '/og/featured-1200x630.jpg';
export const experimental_ppr = true;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Map simple app locales to Open Graph locale format
const ogLocaleMap: Record<Locale, string> = {
  en: 'en_US',
  de: 'de_DE',
  fr: 'fr_FR',
  es: 'es_ES',
  pt: 'pt_PT',
  it: 'it_IT'
};

// Localized metadata
export async function generateMetadata(
  { params }: { params: Promise<{ locale: Locale }> }
): Promise<Metadata> {
  const { locale } = await params;

  // Pull strings from messages.metaRoot.*
  const t = await getTranslations({ locale, namespace: 'metaRoot' });

  const title = t('title');
  const description = t('description');

  // hreflang map (relative paths are fine with metadataBase)
  const languages = Object.fromEntries(
    locales.map((l) => [l, l === defaultLocale ? '/' : `/${l}`])
  );

  const ogLocale = ogLocaleMap[locale];
  const ogAlternate = locales
    .filter((l) => l !== locale)
    .map((l) => ogLocaleMap[l]);

  return {
    title,
    description,
    metadataBase: new URL(siteUrl),
    alternates: {
      languages,
      canonical: locale === defaultLocale ? '/' : `/${locale}`
    },
    openGraph: {
      type: 'website',
      siteName: 'GetSafe 360',
      title,
      description,
      url: locale === defaultLocale ? '/' : `/${locale}`,
      locale: ogLocale,
      alternateLocale: ogAlternate,
    // Featured image for messengers & social
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'GetSafe 360'
      }
    ]
  },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    // Twitter/X uses this
    images: [OG_IMAGE]
    },
  // (Optional) Make favicons crisp in browser UI
  icons: {
    icon: [
      { url: '/icons/favicon.ico' }, // fallback
      { url: '/icons/360.svg', type: 'image/svg+xml' }
    ],
    apple: [{ url: '/icons/apple-icon.png', sizes: '180x180' }]
  }
  };
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  setRequestLocale(locale);

  // With next-intl v3, after setRequestLocale you can call getMessages() without args
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HtmlLang lang={locale} />
      <Header />
      {children}
      <Footer />
      <BackToTopButton />
    </NextIntlClientProvider>
  );
}
