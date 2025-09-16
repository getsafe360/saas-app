// app/[locale]/layout.tsx
import '../globals.css';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Header } from "@/components/ui/header";
import { Footer } from "@/components/ui/footer";
import { NextIntlClientProvider } from 'next-intl';
import BackToTopButton from '@/components/ui/back-to-top-button';
import {getMessages, setRequestLocale} from 'next-intl/server';
import type {ReactNode} from 'react';
import Script from "next/script";

// App-wide metadata
export const metadata: Metadata = {
    title: 'GetSafe 360 AI-driven Website optimization',
    description: 'GetSafe 360° empowers website owners and developers with AI-driven tools for real-time SEO & performance optimization & monitoring.',
};

const geistSans = Geist({ subsets: ['latin'] });
const geistMono = Geist_Mono({ subsets: ['latin'] });
type Params = { locale: string };

export function generateStaticParams() {
  return [{locale: 'en'}, {locale: 'de'}, {locale: 'es'}, {locale: 'fr'}, {locale: 'it'}, {locale: 'pt'}];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<Params> | Params;
}) {
  const { locale } = await (params as Promise<Params>);
  setRequestLocale(locale);

  const messages = await getMessages();
    return (
        <ClerkProvider>
            <html lang={locale} suppressHydrationWarning className={`${geistSans.className} ${geistMono.className}`}>
                <head>
                    {/* GTM main script */}
                    <Script id="gtm-script" strategy="afterInteractive">
                        {`
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());
                        gtag('config', 'G-KVG6YQY625');
                        `}
                    </Script>
                </head>
                <body className="min-h-[100dvh] antialiased bg-stone-50 dark:bg-[#0d1117] text-gray-900 dark:text-gray-100">
                    {/* GTM noscript fallback */}
                    <noscript>
                        <iframe
                            src="https://www.googletagmanager.com/gtag/js?id=G-KVG6YQY625"
                            height="0"
                            width="0"
                            style={{ display: 'none', visibility: 'hidden' }}
                        ></iframe>
                    </noscript>
                        <NextIntlClientProvider locale={locale} messages={messages}>
                         <Header />
                        {children}
                         <Footer />
                       </NextIntlClientProvider>
                 <BackToTopButton />  
                </body>
            </html>
        </ClerkProvider>
    );
}