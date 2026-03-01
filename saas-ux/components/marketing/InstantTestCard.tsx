'use client';

import { useState } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useHomepageTest } from '@/lib/homepage/useHomepageTest';

export default function InstantTestCard() {
  const t = useTranslations('analysis');
  const locale = useLocale();
  const router = useRouter();
  const { openSignUp } = useClerk();
  const { isSignedIn } = useUser();
  const [url, setUrl] = useState('');
  const [openingSignup, setOpeningSignup] = useState(false);
  const test = useHomepageTest();

  const start = () => {
    if (!url.trim()) return;
    const normalized = /^https?:\/\//i.test(url) ? url.trim() : `https://${url.trim()}`;
    void test.startTest(normalized);
  };

  const signupRedirect = `/${locale}/dashboard?testedUrl=${encodeURIComponent(test.testedUrl ?? '')}${
    test.testId ? `&testId=${encodeURIComponent(test.testId)}` : ''
  }`;

  const openSignup = async () => {
    if (!test.testedUrl || !test.testId) return;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        'getsafe360_signup_handoff',
        JSON.stringify({ testedUrl: test.testedUrl, testId: test.testId, redirectUrl: signupRedirect }),
      );
    }

    if (isSignedIn) {
      router.push(signupRedirect);
      return;
    }

    setOpeningSignup(true);
    try {
      if (openSignUp) {
        await openSignUp({
          redirectUrl: signupRedirect,
          afterSignUpUrl: signupRedirect,
          afterSignInUrl: signupRedirect,
        });
      } else {
        router.push(`/${locale}/sign-up?testedUrl=${encodeURIComponent(test.testedUrl)}&testId=${encodeURIComponent(test.testId)}`);
      }
    } finally {
      setOpeningSignup(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-slate-900/70 p-5 shadow-2xl">
      <div className="gs-input-submit-combo flex-col sm:flex-row">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="h-11 w-full border-white/10 bg-slate-950/80 text-base font-medium text-slate-100 placeholder:text-slate-500"
        />
        <Button
          onClick={start}
          disabled={test.phase === 'running'}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-base font-medium ring ring-sky-600/30 transition hover:bg-sky-100 hover:shadow-none dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/30 dark:hover:bg-sky-400/20 sm:w-auto bg-sky-50 text-sky-700"
        >
          {test.phase === 'running' ? t('analyzing') : t('analyze_btn')}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {(test.phase === 'running' || test.phase === 'completed') && (
        <div className="mt-4">
          <div className="h-2 rounded-full border border-emerald-400/20 bg-slate-800/80">
            <div
              className="h-2 rounded-full border border-emerald-400/60 bg-emerald-500/40 transition-all duration-500 ease-out"
              style={{ width: `${test.progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-300">{test.progress}% complete</p>

          <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/40 p-4 text-base leading-relaxed text-slate-200">
            <p className="font-medium text-emerald-200">Sparky</p>
            <p className="mt-2 text-slate-200">{test.greeting}</p>
            <p className="mt-2 text-slate-300">{test.summary || 'Scanning your site and building a live summary…'}</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {test.categories.map((category) => (
              <div key={category.id} className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium capitalize text-white">{category.id}</p>
                  <span className="text-xs text-rose-300">{category.severity ?? 'medium'}</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">{category.issues?.length ?? 0} issues detected</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {test.phase === 'completed' && (
        <div className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-950/20 p-4">
          <p className="text-sm text-emerald-100">{test.summary}</p>
          <Button
            onClick={openSignup}
            disabled={openingSignup || !test.testedUrl || !test.testId}
            className="mt-3 inline-flex items-center gap-2 rounded-md px-4 py-2 text-base font-medium ring ring-sky-600/30 bg-sky-50 text-sky-700 transition hover:bg-sky-100 hover:shadow-none dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/30 dark:hover:bg-sky-400/20"
          >
            {openingSignup ? t('analyzing') : 'Create your free account to see full details and repairs'}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {test.phase === 'error' && (
        <p className="mt-3 text-sm text-amber-300">We&apos;re analyzing your site… If live updates fail, we&apos;ll show final results soon.</p>
      )}
    </section>
  );
}
