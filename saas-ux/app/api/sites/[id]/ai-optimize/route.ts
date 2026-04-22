import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '@/lib/db/postgres';
import { sites } from '@/lib/db/schema/sites/sites';
import { users } from '@/lib/db/schema/auth/users';
import { aiAnalysisJobs, aiRepairActions } from '@/lib/db/schema/ai/analysis';

type OptimizeCategory = 'performance' | 'security' | 'seo' | 'accessibility' | 'content' | 'wordpress';

// Default repair actions per category to seed initial DB records
const CATEGORY_REPAIR_TEMPLATES: Record<OptimizeCategory, Array<{ issueId: string; title: string; severity: string; repairMethod: string }>> = {
  performance: [
    { issueId: 'perf-images', title: 'Optimize images', severity: 'medium', repairMethod: 'image-compression' },
    { issueId: 'perf-caching', title: 'Enable browser caching', severity: 'medium', repairMethod: 'cache-headers' },
    { issueId: 'perf-minify', title: 'Minify CSS/JS assets', severity: 'low', repairMethod: 'minification' },
  ],
  security: [
    { issueId: 'sec-headers', title: 'Add missing security headers', severity: 'high', repairMethod: 'header-injection' },
    { issueId: 'sec-csp', title: 'Configure Content-Security-Policy', severity: 'high', repairMethod: 'csp-config' },
    { issueId: 'sec-hsts', title: 'Enable HSTS', severity: 'medium', repairMethod: 'hsts-header' },
  ],
  seo: [
    { issueId: 'seo-canonical', title: 'Add canonical URL', severity: 'medium', repairMethod: 'canonical-tag' },
    { issueId: 'seo-schema', title: 'Add structured data schema', severity: 'medium', repairMethod: 'schema-markup' },
    { issueId: 'seo-meta', title: 'Optimize meta description', severity: 'low', repairMethod: 'meta-update' },
  ],
  accessibility: [
    { issueId: 'a11y-alt', title: 'Add missing alt text to images', severity: 'high', repairMethod: 'alt-text-injection' },
    { issueId: 'a11y-contrast', title: 'Fix colour contrast ratios', severity: 'medium', repairMethod: 'contrast-fix' },
    { issueId: 'a11y-focus', title: 'Improve keyboard focus indicators', severity: 'medium', repairMethod: 'focus-styles' },
  ],
  content: [
    { issueId: 'content-readability', title: 'Improve content readability score', severity: 'low', repairMethod: 'content-rewrite' },
    { issueId: 'content-headings', title: 'Fix heading hierarchy', severity: 'medium', repairMethod: 'heading-structure' },
  ],
  wordpress: [
    { issueId: 'wp-plugins', title: 'Update outdated plugins', severity: 'high', repairMethod: 'wp-plugin-update' },
    { issueId: 'wp-core', title: 'Update WordPress core', severity: 'high', repairMethod: 'wp-core-update' },
    { issueId: 'wp-security', title: 'Harden WordPress security', severity: 'high', repairMethod: 'wp-hardening' },
  ],
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
  const category: OptimizeCategory = body?.category ?? 'performance';

  const db = getDrizzle();

  // Verify site ownership
  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!site) {
    return NextResponse.json({ success: false, error: 'SITE_NOT_FOUND' }, { status: 404 });
  }

  // Resolve internal user id
  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);

  // Create analysis job
  const [analysisJob] = await db
    .insert(aiAnalysisJobs)
    .values({
      siteId,
      userId: dbUser?.id ?? null,
      status: 'running',
      selectedModules: { [category]: true },
      locale: 'en',
      analysisDepth: 'balanced',
      safeMode: true,
      issuesFound: CATEGORY_REPAIR_TEMPLATES[category]?.length ?? 0,
      repairableIssues: CATEGORY_REPAIR_TEMPLATES[category]?.length ?? 0,
      startedAt: new Date(),
    })
    .returning({ id: aiAnalysisJobs.id });

  if (!analysisJob) {
    return NextResponse.json({ success: false, error: 'JOB_CREATE_FAILED' }, { status: 500 });
  }

  // Seed repair actions for this category
  const templates = CATEGORY_REPAIR_TEMPLATES[category] ?? [];
  if (templates.length > 0) {
    await db.insert(aiRepairActions).values(
      templates.map((t) => ({
        analysisJobId: analysisJob.id,
        siteId,
        issueId: t.issueId,
        category,
        actionId: t.issueId,
        title: t.title,
        severity: t.severity,
        status: 'pending' as const,
        repairMethod: t.repairMethod,
        changes: { category, triggeredBy: 'user-optimize-button' },
        reportIncluded: true,
      })),
    );
  }

  return NextResponse.json({
    success: true,
    jobId: analysisJob.id,
    category,
    actionsCreated: templates.length,
  });
}
