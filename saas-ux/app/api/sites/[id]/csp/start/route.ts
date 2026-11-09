// app/api/sites/[id]/csp/start/route.ts
//
// POST: starts testing a CSP in report-only mode through the connector (≥ 1.10).
// Recorded as an action run, so it appears in Applied changes with Undo.

import { NextRequest, NextResponse } from 'next/server';
import { getDrizzle } from '@/lib/db/postgres';
import { wordpressActionRuns } from '@/lib/db/schema/wordpress/agent';
import { isPublicUrlResolved } from '@/lib/net/isPublicUrlResolved';
import { fetchFollowingSafely } from '@/lib/net/safeFetch';
import { saveTestState } from '@/lib/security/csp/reports';
import { scanSitePages } from '@/lib/security/csp/scan';
import { CSP_TEST_ACTION_ID, CSP_TEST_HEADER, policyFromScan, preparePolicy } from '@/lib/security/csp/start';
import { createWordPressClient } from '@/lib/wordpress/client';
import { loadOwnedSite } from '@/lib/wordpress/site-access';

export const maxDuration = 60;

async function headerVisible(siteUrl: string): Promise<boolean> {
  try {
    const url = new URL(siteUrl);
    url.searchParams.set('gs360_verify', String(Date.now()));
    const response = await fetchFollowingSafely(url.toString(), {
      timeoutMs: 10_000,
      validate: isPublicUrlResolved,
      headers: { Accept: 'text/html', 'User-Agent': 'GetSafe360-WordPressVerifier/1.0' },
    });
    return Boolean(response.headers.get('content-security-policy-report-only'));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await props.params;
  const access = await loadOwnedSite(siteId, { requireConnection: true });
  if ('error' in access) return access.error;
  const { site } = access;
  const tokenHash = access.tokenHash as string;

  const client = createWordPressClient({ siteUrl: site.siteUrl, tokenHash, timeout: 10_000 });
  try {
    const capabilities = await client.getCapabilities();
    if (!capabilities.capabilities?.securityCsp) {
      return NextResponse.json({ success: false, error: 'CONNECTOR_UPDATE' }, { status: 422 });
    }
  } catch {
    return NextResponse.json({ success: false, error: 'CONNECTOR_UNREACHABLE' }, { status: 502 });
  }

  const body = await request.json().catch(() => ({}));
  let policy: string | null = null;
  if (typeof body?.policy === 'string' && body.policy.length > 0) {
    policy = preparePolicy(siteId, body.policy);
    if (!policy) return NextResponse.json({ success: false, error: 'INVALID_POLICY' }, { status: 400 });
  } else {
    const scan = await scanSitePages(site.siteUrl);
    if (scan.pages.length === 0) return NextResponse.json({ success: false, error: 'SITE_UNREACHABLE' }, { status: 502 });
    policy = policyFromScan(siteId, site.siteUrl, scan.pages.map((page) => page.resources));
  }

  let connectorResult: Awaited<ReturnType<typeof client.applyActions>>['results'][number] | null = null;
  try {
    const response = await client.applyActions([
      { id: CSP_TEST_ACTION_ID, type: 'set_security_headers', payload: { headers: { [CSP_TEST_HEADER]: policy } } },
    ]);
    connectorResult = response.results.find((item) => item.id === CSP_TEST_ACTION_ID) ?? null;
  } catch {
    connectorResult = null;
  }
  const applied = connectorResult?.status === 'applied';
  const visible = applied ? await headerVisible(site.siteUrl) : false;

  const db = getDrizzle();
  const [run] = await db
    .insert(wordpressActionRuns)
    .values({
      siteId,
      actionId: CSP_TEST_ACTION_ID,
      actionType: 'set_security_headers',
      title: 'Test a Content-Security-Policy (report-only)',
      status: applied ? (visible ? 'applied' : 'failed') : 'failed',
      risk: 'low',
      autoApplied: false,
      requiresApproval: false,
      inputPayload: { planAction: { payload: { sourceFindingIds: ['sec-csp'] } }, findingId: 'sec-csp', policy },
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

  await saveTestState(siteId, { mode: 'report-only', policy, startedAt: new Date().toISOString(), runId: run?.id ?? null });
  return NextResponse.json({ success: true, policy, runId: run?.id ?? null, visible });
}
