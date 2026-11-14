// app/api/jobs/ai-visibility/route.ts
// The weekly re-check of AI visibility for paid plans. A daily Vercel Cron runs
// it; each call checks the sites whose last run is a week old, as many as fit in
// the time budget, so the work spreads over the week. Authorised by CRON_SECRET
// or an admin session.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/server/isAdminRequest';
import { logger } from '@/lib/logger';
import { hasVisibilityKey } from '@/lib/ai-visibility/claude';
import { QUESTION_LIMIT, RECHECK_INTERVAL_MS, WEEKLY_PLANS } from '@/lib/ai-visibility/config';
import { crawlFor, runVisibility, siteById } from '@/lib/ai-visibility/service';
import { acquireRunLock, loadQuestions, loadRuns, releaseRunLock, trackedSiteIds } from '@/lib/ai-visibility/store';

const log = logger('jobs/ai-visibility');
/** Stop starting new sites after this, leaving room for the last run to finish. */
const BUDGET_MS = 180_000;
/** A run that started a little early still counts as weekly. */
const SLACK_MS = 6 * 60 * 60 * 1000;

async function authorize(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return isAdminRequest();
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!hasVisibilityKey()) return NextResponse.json({ checked: 0, skipped: 'NOT_CONFIGURED' });

  const started = Date.now();
  const checked: string[] = [];
  let due = 0;
  for (const siteId of await trackedSiteIds()) {
    if (Date.now() - started > BUDGET_MS) break;
    const [last] = await loadRuns(siteId, 1);
    if (last && Date.now() - Date.parse(last.checkedAt) < RECHECK_INTERVAL_MS - SLACK_MS) continue;
    const site = await siteById(siteId);
    if (!site || !WEEKLY_PLANS.has(site.plan)) continue;
    const set = await loadQuestions(siteId);
    const questions = (set?.questions ?? []).slice(0, QUESTION_LIMIT[site.plan]);
    if (!set || questions.length === 0) continue;
    due++;
    if (!(await acquireRunLock(siteId))) continue;
    try {
      const crawl = await crawlFor(site);
      if (!crawl) continue;
      await runVisibility({ site, crawl, questions, language: set.language, trigger: 'weekly' });
      checked.push(siteId);
    } catch (error) {
      log.error('weekly run failed', { siteId, error: error instanceof Error ? error.message : String(error) });
    } finally {
      await releaseRunLock(siteId);
    }
  }
  return NextResponse.json({ checked: checked.length, due });
}
