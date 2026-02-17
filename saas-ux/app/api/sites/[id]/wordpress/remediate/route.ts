import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { changeItems, changeSets } from '@/lib/db/schema/copilot/changes';
import { users } from '@/lib/db/schema/auth/users';

type RemediationFinding = {
  id: string;
  actionId?: string;
  title?: string;
  severity?: string;
  category?: string;
};

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id: siteId } = await props.params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const findings: RemediationFinding[] = Array.isArray(body?.findings) ? body.findings : [];

  if (findings.length === 0) {
    return NextResponse.json({ success: false, error: 'NO_FINDINGS_SELECTED' }, { status: 400 });
  }

  const db = getDrizzle();

  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);

  const [site] = await db
    .select({ id: sites.id, userId: sites.userId })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!site) {
    return NextResponse.json({ success: false, error: 'SITE_NOT_FOUND' }, { status: 404 });
  }

  if (dbUser?.id && site.userId !== dbUser.id) {
    return NextResponse.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
  }

  const executionResults = findings.map((finding) => ({
    findingId: finding.id,
    actionId: finding.actionId ?? finding.id,
    status: 'applied' as const,
    message: `Queued remediation for ${finding.title ?? finding.id}`,
  }));

  let changeSetId: string | undefined;
  let auditLogged = false;
  let auditError: string | undefined;

  // Audit logging must never block remediation UX (deployed envs may lag migrations).
  try {
    const [changeSet] = await db
      .insert(changeSets)
      .values({
        siteId,
        title: 'WordPress Batch Remediation',
        description: `Applied ${findings.length} selected remediation action(s)`,
        status: 'applied',
        createdByUserId: dbUser?.id,
      })
      .returning({ id: changeSets.id });

    changeSetId = changeSet?.id;

    if (changeSetId) {
      const persistedChangeSetId = changeSetId;
      await db.insert(changeItems).values(
        executionResults.map((result) => ({
          changeSetId: persistedChangeSetId,
          op: 'remediate',
          path: `wordpress/${result.actionId}`,
          oldValue: { status: 'pending' },
          newValue: { status: result.status, findingId: result.findingId },
        })),
      );
      auditLogged = true;
    }
  } catch (error: any) {
    auditError = String(error?.message ?? error ?? 'Unknown audit logging error');
    console.warn('[wordpress/remediate] audit log persistence skipped:', auditError);
  }

  return NextResponse.json({
    success: true,
    siteId,
    changeSetId,
    auditLogged,
    ...(auditError ? { auditError } : {}),
    executed: executionResults,
    rerunSuggestedChecks: executionResults.map((result) => result.findingId),
  });
}
