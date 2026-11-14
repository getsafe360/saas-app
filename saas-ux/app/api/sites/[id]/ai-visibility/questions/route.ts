// app/api/sites/[id]/ai-visibility/questions/route.ts
// POST { action: "suggest" }: Claude proposes questions from the crawl.
// POST { questions: string[] }: save the user's edited list.

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/api/rate-limit';
import { hasVisibilityKey } from '@/lib/ai-visibility/claude';
import { QUESTION_LIMIT } from '@/lib/ai-visibility/config';
import { brandTerms, normalizeQuestions, siteLanguage } from '@/lib/ai-visibility/questions';
import { crawlFor, siteForUser, suggestQuestions } from '@/lib/ai-visibility/service';
import { loadQuestions, saveQuestions } from '@/lib/ai-visibility/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const site = await siteForUser(userId, siteId);
  if (!site) return NextResponse.json({ error: 'SITE_NOT_FOUND' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { action?: unknown; questions?: unknown; locale?: unknown } | null;
  const locale = typeof body?.locale === 'string' ? body.locale.slice(0, 2) : 'en';
  const limit = QUESTION_LIMIT[site.plan];

  if (body?.action === 'suggest') {
    if (!hasVisibilityKey()) return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 503 });
    const allowed = await rateLimit(`ai-vis-suggest:${siteId}`, 5, 24 * 60 * 60 * 1000);
    if (!allowed.ok) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    const crawl = await crawlFor(site);
    if (!crawl) return NextResponse.json({ error: 'SITE_UNREACHABLE' }, { status: 502 });
    const language = siteLanguage(crawl, locale);
    try {
      const { questions } = await suggestQuestions(crawl, language, site.plan);
      if (questions.length === 0) return NextResponse.json({ error: 'SUGGEST_FAILED' }, { status: 502 });
      await saveQuestions(siteId, { questions, language, updatedAt: new Date().toISOString() });
      return NextResponse.json({ questions, language });
    } catch {
      return NextResponse.json({ error: 'SUGGEST_FAILED' }, { status: 502 });
    }
  }

  if (Array.isArray(body?.questions)) {
    const existing = await loadQuestions(siteId);
    const crawl = await crawlFor(site);
    const questions = normalizeQuestions(body.questions, limit, crawl ? brandTerms(crawl) : []);
    const language = existing?.language ?? siteLanguage(crawl, locale);
    await saveQuestions(siteId, { questions, language, updatedAt: new Date().toISOString() });
    return NextResponse.json({ questions, language, dropped: Math.max(0, body.questions.length - questions.length) });
  }

  return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
}
