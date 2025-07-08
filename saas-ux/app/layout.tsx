import './globals.css';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Header } from "@/components/ui/header";
import { Footer } from "@/components/ui/footer";
import { NextIntlClientProvider } from 'next-intl';
import Script from "next/script";

// App-wide metadata
export const metadata: Metadata = {
    title: 'GetSafe 360 AI-driven Website optimization',
    description: 'GetSafe 360° empowers website owners and developers with AI-driven tools for real-time SEO & performance optimization & monitoring.',
};

const geistSans = Geist({ subsets: ['latin'] });
const geistMono = Geist_Mono({ subsets: ['latin'] });

export default function RootLayout({
    children,
    params,
    messages
}: {
    children: React.ReactNode;
    params: { locale: string };
    messages: Record<string, any>;
}) {
    return (
        <ClerkProvider>
            <html lang={params.locale} className={`${geistSans.className} ${geistMono.className}`}>
                <head>
                    {/* GTM main script */}
                    <Script id="gtm-script" strategy="afterInteractive">
                        {`
                          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                          })(window,document,'script','dataLayer','GTM-NN7RBQ42');
                        `}
                    </Script>
                </head>
                <body className="min-h-[100dvh] antialiased bg-stone-50 dark:bg-[#0d1117] text-gray-900 dark:text-gray-100">
                    {/* GTM noscript fallback */}
                    <noscript>
                        <iframe
                            src="https://www.googletagmanager.com/ns.html?id=GTM-NN7RBQ42"
                            height="0"
                            width="0"
                            style={{ display: 'none', visibility: 'hidden' }}
                        ></iframe>
                    </noscript>
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