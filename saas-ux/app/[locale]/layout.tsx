// app/[locale]/layout.tsx
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/ui/header';
import { Footer } from '@/components/ui/footer';
import BackToTopButton from '@/components/ui/back-to-top-button';
import { HtmlLang } from '@/components/HtmlLang';

// Optional: keep group-level metadata here (server-only)
export const metadata: Metadata = {
  title: 'GetSafe 360 Co-Pilot for your AI-driven Website optimization',
  description:
    'Empowers website owners and developers with AI-driven tools for real-time SEO & performance optimization & monitoring.'
};

export const experimental_ppr = true;

type Params = { locale: string };

export function generateStaticParams() {
  return [
    { locale: 'en' }, { locale: 'de' }, { locale: 'es' },
    { locale: 'fr' }, { locale: 'it' }, { locale: 'pt' }
  ];
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<Params> | Params;
}) {
  const { locale } = await (params as Promise<Params>);
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
