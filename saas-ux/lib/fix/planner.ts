// lib/fix/planner.ts
//
// Turns scan issue IDs into concrete, reviewable operations.
//
// The set of things we can genuinely change on a WordPress site through the
// v1.4.0 connector is small and worth stating plainly:
//
//   POST /wp-json/getsafe360/v1/push     → injects sanitised <head> content.
//        wp_kses allowlist is meta + link only, plus JSON-LD <script> blocks
//        recovered by regex. So: meta tags, link tags, structured data.
//   POST /wp-json/getsafe360/v1/actions  → two settings, disableXmlRpc and
//        blockUserEnumeration. Anything else returns "Unsupported action type".
//
// Everything outside that is not fixable today, and the planner says so
// instead of pretending. `rejected` entries surface in the UI.

import 'server-only';

import { fetchFollowingSafely } from '@/lib/net/safeFetch';
import { isPublicUrlResolved } from '@/lib/net/isPublicUrlResolved';
import { balanceTags } from '@/lib/net/sanitizeHtml';
import { logger } from '@/lib/logger';
import type { FixOperation, FixProposal } from '@/lib/fix/types';
import type { ScanIssue, ScanReport } from '@/lib/scan/types';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const log = logger('fix/planner');

/** Issue IDs the connector can actually act on. */
// Fixes that apply to the whole site. Page-specific head snippets (meta description, canonical,
// Open Graph) are deliberately NOT here: the connector emits every stored snippet on every
// page, so they would be published site-wide with the homepage's values. Add them back once
// the plugin can scope a snippet to the page it was written for.
export const FIXABLE_ISSUE_IDS = new Set([
  'seo-schema-missing',
  'sec-wp-xmlrpc',
  'sec-wp-user-enum',
]);

type PageContext = {
  title: string;
  description: string;
  /** First few hundred words of visible text, used to write copy from. */
  text: string;
  host: string;
  origin: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadPageContext(siteUrl: string): Promise<PageContext> {
  const url = new URL(siteUrl);
  // The page is user-controlled: validate every redirect hop (and DNS), and neutralise
  // unclosed "<" so the extraction regexes below stay linear on hostile pages.
  const res = await fetchFollowingSafely(siteUrl, { timeoutMs: 8000, validate: isPublicUrlResolved });
  const html = balanceTags((await res.text()).slice(0, 300_000));

  return {
    title: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim(),
    description: (
      html.match(
        /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
      )?.[1] ?? ''
    ).trim(),
    text: stripHtml(html).slice(0, 2000),
    host: url.hostname,
    origin: url.origin,
  };
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Deterministic copy, used when no model is configured or the call fails. */
function fallbackDescription(ctx: PageContext): string {
  const sentence = ctx.text.split(/(?<=[.!?])\s+/).find((s) => s.length > 60);
  const base = sentence ?? ctx.text;
  const trimmed = base.slice(0, 155).trim();
  return trimmed.length > 40 ? trimmed : `${ctx.title} — ${ctx.host}`.slice(0, 155);
}

async function writeDescription(ctx: PageContext, locale: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return fallbackDescription(ctx);

  try {
    const { text } = await generateText({
      model: openai(process.env.MODEL ?? 'gpt-4o-mini'),
      temperature: 0.3,
      maxOutputTokens: 120,
      system:
        'You write meta descriptions. Reply with the description text only — no quotes, no markdown, no explanation. ' +
        'Between 120 and 155 characters. Describe only what the page content supports; never invent services, ' +
        'locations, claims or prices.',
      prompt: `Language: ${locale}\nPage title: ${ctx.title}\nPage text: ${ctx.text.slice(0, 1200)}`,
    });
    const cleaned = text.trim().replace(/^["']|["']$/g, '');
    if (cleaned.length < 40) return fallbackDescription(ctx);
    return cleaned.slice(0, 160);
  } catch (err) {
    log.warn('description generation failed, using page text', { host: ctx.host, reason: String(err) });
    return fallbackDescription(ctx);
  }
}

function buildOrganizationSchema(ctx: PageContext, description: string): string {
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ctx.title.split(/[|\-–—]/)[0]!.trim() || ctx.host,
    url: `${ctx.origin}/`,
    description,
  };
  // The connector recovers JSON-LD blocks with a regex after wp_kses, and the
  // plugin escapes </script sequences itself. JSON.stringify already prevents
  // raw angle brackets from appearing unescaped in string values.
  return `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

export type PlanFixesParams = {
  siteId: string;
  siteUrl: string;
  report: ScanReport;
  issueIds: string[];
  locale?: string;
};

export async function planFixes({
  siteId,
  siteUrl,
  report,
  issueIds,
  locale = 'en',
}: PlanFixesParams): Promise<FixProposal> {
  const byId = new Map<string, ScanIssue>();
  for (const issue of report.issues ?? []) byId.set(issue.id, issue);

  const operations: FixOperation[] = [];
  const rejected: FixProposal['rejected'] = [];

  const requested = issueIds
    .map((id) => byId.get(id))
    .filter((i): i is ScanIssue => Boolean(i));

  for (const id of issueIds) {
    if (!byId.has(id)) {
      rejected.push({ issueId: id, reason: 'This finding is not part of the latest scan.' });
    }
  }

  const actionable = requested.filter((i) => {
    if (!FIXABLE_ISSUE_IDS.has(i.id)) {
      rejected.push({
        issueId: i.id,
        reason: 'This finding needs a change the WordPress connector cannot make yet.',
      });
      return false;
    }
    return true;
  });

  if (actionable.length === 0) {
    return {
      siteId,
      siteUrl,
      generatedAt: new Date().toISOString(),
      operations: [],
      rejected,
      estTokens: 0,
    };
  }

  const needsCopy = actionable.some((i) =>
    ['seo-schema-missing'].includes(i.id)
  );

  let ctx: PageContext | null = null;
  if (needsCopy) {
    try {
      ctx = await loadPageContext(siteUrl);
    } catch (err) {
      log.error('could not load page context for planning', err, { siteUrl });
      throw new Error('We could not read the page in order to prepare the fix. Please try again.');
    }
  }

  // Description is reused by the meta tag, the OG tags and the schema block,
  // so generate it once.
  let description: string | null = null;
  if (ctx && needsCopy) {
    description = await writeDescription(ctx, locale);
  }

  for (const issue of actionable) {
    switch (issue.id) {
      case 'seo-schema-missing': {
        if (!ctx) break;
        operations.push({
          kind: 'head_snippet',
          issueId: issue.id,
          title: 'Publish Organization structured data',
          snippet: buildOrganizationSchema(ctx, description ?? ctx.description),
          effect:
            'Gives search engines and AI answer engines a machine-readable description of your organisation.',
        });
        break;
      }

      case 'sec-wp-xmlrpc': {
        operations.push({
          kind: 'connector_setting',
          issueId: issue.id,
          title: 'Disable XML-RPC',
          key: 'disableXmlRpc',
          enabled: true,
          effect:
            'Blocks xmlrpc.php, removing a common brute-force amplification and pingback abuse target. Reversible from the plugin settings.',
        });
        break;
      }

      case 'sec-wp-user-enum': {
        operations.push({
          kind: 'connector_setting',
          issueId: issue.id,
          title: 'Block user enumeration',
          key: 'blockUserEnumeration',
          enabled: true,
          effect:
            'Stops anonymous visitors listing your usernames through the REST API and author archives. Reversible from the plugin settings.',
        });
        break;
      }
    }
  }

  const covered = new Set(operations.map((o) => o.issueId));
  for (const issue of actionable) {
    if (!covered.has(issue.id)) {
      rejected.push({
        issueId: issue.id,
        reason: 'We could not prepare a safe change for this finding.',
      });
    }
  }

  const estTokens = actionable
    .filter((i) => covered.has(i.id))
    .reduce((sum, i) => sum + (i.estTokens || 0), 0);

  return {
    siteId,
    siteUrl,
    generatedAt: new Date().toISOString(),
    operations,
    rejected,
    estTokens,
  };
}
