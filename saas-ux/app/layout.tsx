import './globals.css';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';

const geistSans = Geist({ subsets: ['latin'] });
const geistMono = Geist_Mono({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en" // default; we’ll update it per-locale from the child layout (optional helper below)
      suppressHydrationWarning
      className={`${geistSans.className} ${geistMono.className}`}
    >
      <head>
        {/* Correct GTM container snippet */}
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NN7RBQ42');`}
        </Script>
      </head>
      <body className="min-h-[100dvh] antialiased bg-stone-50 dark:bg-[#0d1117] text-gray-900 dark:text-gray-100">
        <ClerkProvider>
          {children}
        </ClerkProvider>

        {/* GTM noscript fallback (uses /ns.html, not gtag/js) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-NN7RBQ42"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      </body>
    </html>
  );
}
