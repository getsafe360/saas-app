import './globals.css';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Header } from "@/components/ui/header";
import { Footer } from "@/components/ui/footer";
import { NextIntlClientProvider } from 'next-intl';

// App-wide metadata
export const metadata: Metadata = {
    title: 'GetSafe 360 AI-driven Website optimization',
    description: 'GetSafe 360° empowers website owners and developers with AI-driven tools for real-time SEO & performance optimization & monitoring.',
};

// Load fonts (removing `variable` if not using CSS vars)
const geistSans = Geist({ subsets: ['latin'] });
const geistMono = Geist_Mono({ subsets: ['latin'] });

// RootLayout now gets locale and messages (for i18n), usually via props or a loader
export default function RootLayout({
    children,
    params,     // <-- Needed for locale
    messages    // <-- Needed for translations
}: {
    children: React.ReactNode;
    params: { locale: string };        // Next.js convention if you use [locale]/...
    messages: Record<string, any>;     // NextIntl messages for current locale
}) {
    return (
        <ClerkProvider>
            <html lang={params.locale} className={`${geistSans.className} ${geistMono.className}`}>
                <body className="min-h-[100dvh] antialiased bg-white dark:bg-[#0d1117] text-slate-900 dark:text-slate-300">
                    <NextIntlClientProvider locale={params.locale} messages={messages}>
                        <Header />
                        {children}
                        <Footer />
                    </NextIntlClientProvider>
                </body>
            </html>
        </ClerkProvider>
    );
}