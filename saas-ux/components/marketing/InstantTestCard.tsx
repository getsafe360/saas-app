'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useHomepageTest } from '@/lib/homepage/useHomepageTest';

export default function InstantTestCard() {
  const [url, setUrl] = useState('');
  const test = useHomepageTest();

  const start = () => {
    if (!url.trim()) return;
    const normalized = /^https?:\/\//i.test(url) ? url.trim() : `https://${url.trim()}`;
    void test.startTest(normalized);
  };

  const signupHref = `/sign-up?testedUrl=${encodeURIComponent(test.testedUrl ?? '')}${
    test.testId ? `&testId=${encodeURIComponent(test.testId)}` : ''
  }`;

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-slate-900/70 p-5 shadow-2xl">
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="bg-slate-950/80"
        />
        <Button onClick={start} disabled={test.phase === 'running'}>
          {test.phase === 'running' ? 'Analyzing…' : 'Test my site'}
        </Button>
      </div>

      {(test.phase === 'running' || test.phase === 'completed') && (
        <div className="mt-4">
          <div className="h-2 rounded-full bg-slate-800">
            <div className="h-2 rounded-full bg-sky-500 transition-all" style={{ width: `${test.progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-300">{test.progress}% complete</p>

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
          <Button asChild className="mt-3">
            <a href={signupHref}>Create your free account to see full details and repairs</a>
          </Button>
        </div>
      )}

      {test.phase === 'error' && (
        <p className="mt-3 text-sm text-amber-300">We&apos;re analyzing your site… If live updates fail, we&apos;ll show final results soon.</p>
      )}
    </section>
  );
}
