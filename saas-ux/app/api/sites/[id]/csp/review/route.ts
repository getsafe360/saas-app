// app/api/sites/[id]/csp/review/route.ts
//
// POST { locale }: turns the reports collected during the report-only test into
// a proposal: every blocked source with an allow/block verdict (Claude's advice
// when available) and the policy that would be switched on. Changes nothing.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api/rate-limit';
import { applyVerdicts, buildCandidates, defaultVerdicts } from '@/lib/security/csp/proposal';
import { readTestState, readViolations } from '@/lib/security/csp/reports';
import { mergeCspReview } from '@/lib/security/csp/review';
import { cspReviewAvailable, reviewCspCandidates } from '@/lib/security/csp/review-ai';
import { loadOwnedSite } from '@/lib/wordpress/site-access';

export const maxDuration = 90;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await props.params;
  const access = await loadOwnedSite(siteId);
  if ('error' in access) return access.error;

  const state = await readTestState(siteId);
  if (!state || state.mode !== 'report-only') {
    return NextResponse.json({ success: false, error: 'NO_TEST' }, { status: 409 });
  }

  const limit = await rateLimit(`csp-review:${siteId}`, 10, 60 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ success: false, error: 'RATE_LIMITED' }, { status: 429 });

  const body = (await request.json().catch(() => ({}))) as { locale?: unknown };
  const locale = typeof body.locale === 'string' ? body.locale : 'en';

  const candidates = buildCandidates(state.policy, await readViolations(siteId));
  const defaults = defaultVerdicts(candidates);
  let summary: string | null = null;
  let aiUsed = false;
  let verdicts = defaults;

  if (candidates.length > 0 && cspReviewAvailable()) {
    try {
      const output = await reviewCspCandidates({ host: hostOf(access.site.siteUrl), locale, policy: state.policy, candidates });
      verdicts = mergeCspReview(candidates, defaults, output);
      summary = output.summary.trim() || null;
      aiUsed = true;
    } catch (error) {
      console.error('[csp-review] AI review failed', error);
    }
  }

  const allowed = verdicts.filter((verdict) => verdict.decision === 'allow').map((verdict) => verdict.key);
  return NextResponse.json(
    {
      success: true,
      aiUsed,
      summary,
      testedPolicy: state.policy,
      candidates: candidates.map((candidate, index) => ({ ...candidate, ...verdicts[index] })),
      policy: applyVerdicts(state.policy, candidates, allowed),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
