'use client';

import { useTranslations } from 'next-intl';
import { PricingCards } from '@/components/pricing/pricing-cards';

export default function PlansPage() {
  const t = useTranslations('plans');

  return (
    <main className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 min-h-[90vh] bg-[--page-bg] transition-colors">
      <div className="max-w-7xl w-full mx-auto">
        {/* Headline Section */}
        <section className="mb-12 text-center">
          <h1 className="font-extrabold text-4xl sm:text-6xl tracking-tight mb-6">
            <span className="bg-gradient-to-r from-white via-sky-300/80 to-sky-400/70 bg-clip-text text-transparent">
              {t('headline1')}
            </span>
          </h1>
          <h2 className="text-xl font-semibold sm:text-2xl mb-6">
            <span className="font-bold text-3xl sm:text-5xl text-blue-600 block">
              {t('headline2')}
            </span>
          </h2>
          <p className="text-lg font-medium sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            {t('subheadline')}
          </p>
        </section>

        {/* Pricing Cards */}
        <PricingCards />

        {/* Token Info Section */}
        <section className="mt-16 max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-blue-50/50 to-sky-50/50 dark:from-blue-950/20 dark:to-sky-950/20 rounded-2xl p-8 border border-blue-200/50 dark:border-blue-800/50">
            <h3 className="text-2xl font-bold mb-4 text-center">{t('tokenInfo.title')}</h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-semibold mb-2 text-blue-600 dark:text-blue-400">{t('tokenInfo.whatAreTokens')}</h4>
                <p className="text-muted-foreground">{t('tokenInfo.tokensExplained')}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-blue-600 dark:text-blue-400">{t('tokenInfo.howManyNeeded')}</h4>
                <p className="text-muted-foreground">{t('tokenInfo.usageExplained')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-12 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold mb-6 text-center">{t('faq.title')}</h3>
          <div className="space-y-4">
            <details className="group bg-card dark:bg-[#1f2123] rounded-lg p-6 border border-[--thin-border]">
              <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                <span>{t('faq.q1')}</span>
                <svg className="w-5 h-5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="mt-4 text-muted-foreground">{t('faq.a1')}</p>
            </details>

            <details className="group bg-card dark:bg-[#1f2123] rounded-lg p-6 border border-[--thin-border]">
              <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                <span>{t('faq.q2')}</span>
                <svg className="w-5 h-5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="mt-4 text-muted-foreground">{t('faq.a2')}</p>
            </details>

            <details className="group bg-card dark:bg-[#1f2123] rounded-lg p-6 border border-[--thin-border]">
              <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                <span>{t('faq.q3')}</span>
                <svg className="w-5 h-5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="mt-4 text-muted-foreground">{t('faq.a3')}</p>
            </details>

            <details className="group bg-card dark:bg-[#1f2123] rounded-lg p-6 border border-[--thin-border]">
              <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                <span>{t('faq.q4')}</span>
                <svg className="w-5 h-5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="mt-4 text-muted-foreground">{t('faq.a4')}</p>
            </details>
          </div>
        </section>
      </div>
    </main>
  );
}
