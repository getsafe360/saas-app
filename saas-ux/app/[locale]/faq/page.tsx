// app/[locale]/faq/page.tsx
import * as React from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import type { Locale } from '@/i18n/locales';

type Params = { locale: Locale };
type Props = { params: Promise<Params> };

// Optional: keep this page static per locale
// export const dynamic = 'force-static';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metaFaq' });
  return { title: t('title'), description: t('description') };
}

export default async function FAQPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'faq' });

  const faqs: Array<{ q: string; a: React.ReactNode; id: string }> = [
    {
      id: 'what-is',
      q: t('q1'),
      a: (
        <p>
          {t('a1.part1')}{' '}
          <strong>GitHub</strong>{' '}
          {t('a1.part2')}
        </p>
      )
    },
    { id: 'how-it-works', q: t('q2'), a: <p>{t('a2')}</p> },
    {
      id: 'pricing',
      q: t('q3'),
      a: (
        <p>
          {t('a3.part1')}{' '}
          <Link href="/plans" className="underline decoration-sky-500/60 underline-offset-4">
            {t('a3.link')}
          </Link>{' '}
          {t('a3.part2')}
        </p>
      )
    },
    { id: 'platforms', q: t('q4'), a: <p>{t('a4')}</p> },
    {
      id: 'get-started',
      q: t('q5'),
      a: (
        <p>
          {t('a5.part1')}{' '}
          <Link href="/" className="underline decoration-sky-500/60 underline-offset-4">
            {t('a5.link')}
          </Link>{' '}
          {t('a5.part2')}
        </p>
      )
    },
    { id: 'coding-required', q: t('q6'), a: <p>{t('a6')}</p> },
    { id: 'data-security', q: t('q7'), a: <p>{t('a7')}</p> },
    { id: 'cancel-anytime', q: t('q8'), a: <p>{t('a8')}</p> },
    { id: 'payment-methods', q: t('q9'), a: <p>{t('a9')}</p> }
  ];

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {t('title')}
      </h1>
      <p className="mt-2 text-slate-700 dark:text-slate-300">{t('lead')}</p>

      <div className="mt-8 divide-y divide-slate-200 dark:divide-white/10">
        {faqs.map((item) => (
          <details key={item.id} id={item.id} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-left">
              <span className="text-base font-medium text-slate-900 dark:text-slate-100">{item.q}</span>
              <span
                className="ml-4 size-6 rounded-md ring-1 ring-slate-900/10 dark:ring-white/10 grid place-items-center text-slate-500 group-open:rotate-180 transition-transform"
                aria-hidden
              >
                ▾
              </span>
            </summary>
            <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {item.a}
            </div>
          </details>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-slate-200 dark:border-white/10 p-4 bg-white/60 dark:bg-white/[0.03]">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {t('footer.hint')}{' '}
          <Link href="/accessibility" className="underline decoration-sky-500/60 underline-offset-4">
            {t('footer.link')}
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
