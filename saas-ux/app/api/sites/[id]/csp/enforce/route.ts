// app/api/sites/[id]/csp/enforce/route.ts
//
// POST { allow: string[] }: switches the tested policy on. The policy is
// recomputed here from the test and the candidate keys the owner allowed, so
// the browser never sends a policy of its own. The connector replaces the
// report-only header with the enforcing one in one step, and undo restores the
// test. Reports keep arriving, now for what the policy actually blocks.

import { NextRequest, NextResponse } from 'next/server';
import { getDrizzle } from '@/lib/db/postgres';
import { wordpressActionRuns } from '@/lib/db/schema/wordpress/agent';
import { isPublicUrlResolved } from '@/lib/net/isPublicUrlResolved';
import { fetchFollowingSafely } from '@/lib/net/safeFetch';
import { applyVerdicts, buildCandidates, CSP_ENFORCE_ACTION_ID, CSP_ENFORCE_HEADER } from '@/lib/security/csp/proposal';
import { readTestState, readViolations, saveTestState } from '@/lib/security/csp/reports';
import { CSP_TEST_HEADER, preparePolicy } from '@/lib/security/csp/start';
import { createWordPressClient } from '@/lib/wordpress/client';
import { loadOwnedSite } from '@/lib/wordpress/site-access';

export const maxDuration = 60;

async function enforcedHeader(siteUrl: string): Promise<string | null> {
  try {
    const url = new URL(siteUrl);
    url.searchParams.set('gs360_verify', String(Date.now()));
    const response = await fetchFollowingSafely(url.toString(), {
      timeoutMs: 10_000,
      validate: isPublicUrlResolved,
      headers: { Accept: 'text/html', 'User-Agent': 'GetSafe360-WordPressVerifier/1.0' },
    });
    return response.headers.get('content-security-policy');
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await props.params;
  const access = await loadOwnedSite(siteId, { requireConnection: true });
  if ('error' in access) return access.error;
  const { site } = access;
  const tokenHash = access.tokenHash as string;

  const state = await readTestState(siteId);
  if (!state || state.mode !== 'report-only') {
    return NextResponse.json({ success: false, error: 'NO_TEST' }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as { allow?: unknown };
  const allow = Array.isArray(body.allow) ? body.allow.filter((key): key is string => typeof key === 'string').slice(0, 200) : [];
  // Every candidate, not only the top ones shown for review: an allowed source
  // must not drop out because other reports outranked it in the meantime.
  const candidates = buildCandidates(state.policy, await readViolations(siteId), Number.POSITIVE_INFINITY);
  const known = new Set(candidates.map((candidate) => candidate.key));
  if (allow.some((key) => !known.has(key))) {
    // The reports changed since the review (e.g. old ones expired): review again rather than switch on something else.
    return NextResponse.json({ success: false, error: 'REVIEW_STALE' }, { status: 409 });
  }
  const policy = preparePolicy(siteId, applyVerdicts(state.policy, candidates, allow));
  if (!policy) return NextResponse.json({ success: false, error: 'INVALID_POLICY' }, { status: 400 });

  const client = createWordPressClient({ siteUrl: site.siteUrl, tokenHash, timeout: 10_000 });
  try {
    const capabilities = await client.getCapabilities();
    if (!capabilities.capabilities?.securityCsp) {
      return NextResponse.json({ success: false, error: 'CONNECTOR_UPDATE' }, { status: 422 });
    }
  } catch {
    return NextResponse.json({ success: false, error: 'CONNECTOR_UNREACHABLE' }, { status: 502 });
  }

  let connectorResult: Awaited<ReturnType<typeof client.applyActions>>['results'][number] | null = null;
  try {
    const response = await client.applyActions([
      {
        id: CSP_ENFORCE_ACTION_ID,
        type: 'set_security_headers',
        // One step: switch the policy on and end the report-only test.
        payload: { headers: { [CSP_ENFORCE_HEADER]: policy, [CSP_TEST_HEADER]: null } },
      },
    ]);
    connectorResult = response.results.find((item) => item.id === CSP_ENFORCE_ACTION_ID) ?? null;
  } catch {
    connectorResult = null;
  }
  const applied = connectorResult?.status === 'applied';
  const live = applied ? await enforcedHeader(site.siteUrl) : null;
  const visible = Boolean(live);

  const db = getDrizzle();
  const [run] = await db
    .insert(wordpressActionRuns)
    .values({
      siteId,
      actionId: CSP_ENFORCE_ACTION_ID,
      actionType: 'set_security_headers',
      title: 'Switch on the Content-Security-Policy',
      status: applied ? (visible ? 'applied' : 'failed') : 'failed',
      risk: 'medium',
      autoApplied: false,
      requiresApproval: true,
      inputPayload: { planAction: { payload: { sourceFindingIds: ['sec-csp'] } }, findingId: 'sec-csp', policy, allowed: allow },
      resultPayload: { message: connectorResult?.message ?? 'The connector did not apply the policy.', connectorResult },
      rollbackPayload: connectorResult?.rollback ?? null,
      verificationOk: applied ? visible : null,
      startedAt: new Date(),
      completedAt: new Date(),
    })
    .returning({ id: wordpressActionRuns.id });

  if (!applied) {
    return NextResponse.json(
      { success: false, error: 'CONNECTOR_FAILED', message: connectorResult?.message ?? null },
      { status: 502 },
    );
  }

  await saveTestState(siteId, { mode: 'enforced', policy, startedAt: new Date().toISOString(), runId: run?.id ?? null });
  return NextResponse.json({ success: true, policy, runId: run?.id ?? null, visible });
}
