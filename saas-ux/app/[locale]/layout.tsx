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

// ✅ Localized metadata
export async function generateMetadata(
  { params: { locale } }: { params: { locale: Locale } }
): Promise<Metadata> {
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
      languages, // <link rel="alternate" hreflang="...">
      canonical: locale === defaultLocale ? '/' : `/${locale}`
    },
    openGraph: {
      type: 'website',
      siteName: 'GetSafe 360',
      title,
      description,
      url: locale === defaultLocale ? '/' : `/${locale}`,
      locale: ogLocale,
      alternateLocale: ogAlternate
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description
    }
  };
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: { locale: Locale };
}) {
  const { locale } = params;
  setRequestLocale(locale);

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
