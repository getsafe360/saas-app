// lib/scan/runner.ts
//
// The real scan. Replaces makeSampleReport(), which returned the same
// hardcoded score of 87 and the same three invented issues for every site.
//
// Three stages, each of which degrades on its own without failing the scan:
//   1. preScan  — one HTTP fetch, HTML/header parsing, WordPress detection.
//                 Required. If this fails there is nothing to report.
//   2. PageSpeed — Google Lighthouse scores. Optional (needs PAGESPEED_API_KEY);
//                 when absent we fall back to rule-derived scores.
//   3. Prose    — a short LLM summary of the findings. Optional; when the model
//                 call fails we synthesise a factual summary from the rules.
//
// Everything the user sees is traceable to something we actually measured.

import 'server-only';

import { preScan } from '@/lib/analyzer/preScan';
import { isPublicUrlResolved } from '@/lib/net/isPublicUrlResolved';
import { getPageSpeedSummary, type PageSpeedSummary } from '@/lib/analyzer/pageSpeed';
import { isPublicUrl } from '@/lib/net/isPublicUrl';
import { runRules } from '@/lib/scan/rules';
import type { CategoryScores, ScanCategory, ScanIssue, ScanReport } from '@/lib/scan/types';
import { logger } from '@/lib/logger';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const log = logger('scan/runner');

const CATEGORIES: ScanCategory[] = ['seo', 'performance', 'accessibility', 'security'];

const SEVERITY_PENALTY: Record<ScanIssue['severity'], number> = {
  high: 22,
  medium: 11,
  low: 4,
};

export class ScanError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'ScanError';
  }
}

/** Rule-derived score for one category: start at 100, subtract severity weights. */
function ruleScore(issues: ScanIssue[]): number {
  const penalty = issues.reduce((acc, i) => acc + SEVERITY_PENALTY[i.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

/**
 * Blend Lighthouse and rule scores where both exist.
 *
 * Lighthouse is the better measurement for performance (it actually loads the
 * page); our rules are better for security (Lighthouse does not score it at
 * all) and catch things Lighthouse ignores. Weighting Lighthouse at 60% keeps
 * the number recognisable to anyone who also runs PageSpeed Insights, while
 * still moving when we find something it missed.
 */
function blendScores(
  issuesByCategory: Record<ScanCategory, ScanIssue[]>,
  pageSpeed: PageSpeedSummary | null
): CategoryScores {
  const scores = {} as CategoryScores;

  for (const category of CATEGORIES) {
    const fromRules = ruleScore(issuesByCategory[category]);
    const fromLighthouse =
      category === 'security' ? undefined : pageSpeed?.categories?.[category];

    scores[category] =
      typeof fromLighthouse === 'number'
        ? Math.round(fromLighthouse * 0.6 + fromRules * 0.4)
        : fromRules;
  }

  return scores;
}

function groupByCategory(issues: ScanIssue[]): Record<ScanCategory, ScanIssue[]> {
  const grouped = {
    seo: [] as ScanIssue[],
    performance: [] as ScanIssue[],
    accessibility: [] as ScanIssue[],
    security: [] as ScanIssue[],
  };
  for (const i of issues) grouped[i.category].push(i);
  return grouped;
}

/** Factual summary used when no LLM is available, or when the model call fails. */
function fallbackProse(
  siteUrl: string,
  issues: ScanIssue[],
  scores: CategoryScores
): string {
  const host = (() => {
    try {
      return new URL(siteUrl).hostname;
    } catch {
      return siteUrl;
    }
  })();

  if (issues.length === 0) {
    return `We checked ${host} against our SEO, performance, accessibility and security rules and did not find any issues in this pass. That covers page metadata, response headers, image alt coverage and WordPress exposure checks — a deeper crawl of individual pages may still surface more.`;
  }

  const high = issues.filter((i) => i.severity === 'high');
  const weakest = CATEGORIES.reduce((a, b) => (scores[a] <= scores[b] ? a : b));
  const categoryLabel: Record<ScanCategory, string> = {
    seo: 'SEO',
    performance: 'performance',
    accessibility: 'accessibility',
    security: 'security',
  };

  const parts = [
    `We found ${issues.length} issue${issues.length === 1 ? '' : 's'} on ${host}.`,
    high.length > 0
      ? `${high.length} ${high.length === 1 ? 'is' : 'are'} high severity, starting with "${high[0]!.title}".`
      : 'None are high severity.',
    `The weakest area is ${categoryLabel[weakest]} at ${scores[weakest]}/100.`,
  ];

  return parts.join(' ');
}

async function generateProse(
  siteUrl: string,
  issues: ScanIssue[],
  scores: CategoryScores,
  locale: string
): Promise<{ prose: string; usedModel: boolean }> {
  if (!process.env.OPENAI_API_KEY) {
    return { prose: fallbackProse(siteUrl, issues, scores), usedModel: false };
  }

  const facts = issues
    .slice(0, 12)
    .map((i) => `- [${i.severity}] ${i.category}: ${i.title} — ${i.description}`)
    .join('\n');

  try {
    const { text } = await generateText({
      model: openai(process.env.MODEL ?? 'gpt-4o-mini'),
      temperature: 0.2,
      maxOutputTokens: 320,
      system:
        'You summarise website audit results for a small-business owner. Write in the requested language. ' +
        'Two short paragraphs, no headings, no bullet points, no markdown. ' +
        'Only state facts present in the findings — never invent scores, metrics or issues. ' +
        'Be direct about what is wrong and what to do first.',
      prompt:
        `Language: ${locale}\n` +
        `Site: ${siteUrl}\n` +
        `Scores — SEO ${scores.seo}, performance ${scores.performance}, ` +
        `accessibility ${scores.accessibility}, security ${scores.security} (each out of 100).\n\n` +
        `Findings:\n${facts || '(no issues found)'}\n`,
    });

    const cleaned = text.trim();
    if (!cleaned) throw new Error('empty model response');
    return { prose: cleaned, usedModel: true };
  } catch (err) {
    log.warn('prose generation failed, using factual fallback', {
      siteUrl,
      reason: err instanceof Error ? err.message : String(err),
    });
    return { prose: fallbackProse(siteUrl, issues, scores), usedModel: false };
  }
}

export type RunScanOptions = {
  siteUrl: string;
  categories?: ScanCategory[];
  locale?: string;
};

export async function runScan({
  siteUrl,
  categories,
  locale = 'en',
}: RunScanOptions): Promise<ScanReport> {
  if (!isPublicUrl(siteUrl)) {
    throw new ScanError('Site URL is not a public http(s) address', 'invalid_url');
  }

  const started = Date.now();

  let pre: Awaited<ReturnType<typeof preScan>>;
  try {
    pre = await preScan(siteUrl, { validate: isPublicUrlResolved });
  } catch (err) {
    log.error('preScan failed', err, { siteUrl });
    throw new ScanError(
      'We could not reach the site. Check that it is online and publicly accessible.',
      'unreachable'
    );
  }

  if (pre.status >= 400) {
    throw new ScanError(
      `The site responded with HTTP ${pre.status}.`,
      'bad_status'
    );
  }

  // PageSpeed is a 10–20s call; it must never be the reason a scan fails.
  const pageSpeed = await getPageSpeedSummary(pre.finalUrl, { timeoutMs: 25_000 }).catch(
    (err) => {
      log.warn('pagespeed lookup failed', { siteUrl, reason: String(err) });
      return null;
    }
  );

  const requested = categories?.length ? new Set(categories) : new Set(CATEGORIES);
  const issues = runRules({ pre, headers: pre.headers }).filter((i) =>
    requested.has(i.category)
  );

  const grouped = groupByCategory(issues);
  const categoryScores = blendScores(grouped, pageSpeed);

  const requestedList = CATEGORIES.filter((c) => requested.has(c));
  const overall = Math.round(
    requestedList.reduce((sum, c) => sum + categoryScores[c], 0) / requestedList.length
  );

  const { prose, usedModel } = await generateProse(
    pre.finalUrl,
    issues,
    categoryScores,
    locale
  );

  const counts: Record<string, number> = {};
  for (const c of requestedList) counts[c] = grouped[c].length;

  const report: ScanReport = {
    siteUrl: pre.finalUrl,
    generatedAt: new Date().toISOString(),
    summary: {
      score: overall,
      counts,
      categoryScores,
      estTotalTokens: issues.reduce((sum, i) => sum + (i.fixAvailable ? i.estTokens : 0), 0),
      prose,
    },
    issues,
    pagesAnalyzed: [pre.finalUrl],
    coverage: {
      pageSpeed: pageSpeed !== null,
      prose: usedModel,
      cms: pre.cms.type === 'wordpress' ? 'wordpress' : 'unknown',
    },
  };

  log.info('scan complete', {
    siteUrl: pre.finalUrl,
    durationMs: Date.now() - started,
    issueCount: issues.length,
    score: overall,
    pageSpeed: pageSpeed !== null,
  });

  return report;
}
