// lib/engine/fixers/wordpress/geo.ts
//
// GEO fixes through the connector (1.12): an llms.txt built from the crawl,
// robots.txt rules that let AI answer engines read the site, and the home
// page's Organization / WebSite schema. Each connector action returns its own
// inverse, so every one of them can be undone. They only plan when the site's
// setup lets the change work (root install, no physical file, no SEO plugin
// that already writes the schema); otherwise the finding stays guided.

import { AI_CRAWLERS, SEARCH_CRAWLERS, isAllowed, parseRobots } from '@/lib/engine/seo/robots';
import { parseSeoPage } from '@/lib/engine/seo/page';
import { buildLlmsTxt } from '@/lib/seo/llms';
import type {
  WordPressAiCrawlerRulesPayload,
  WordPressLlmsTxtPayload,
  WordPressSchemaPayload,
} from '@/lib/wordpress/types';
import { type ConnectorFixer, type FixerVerifyContext, type VerificationCheck, verificationResult } from '../types';

const USER_AGENT = 'GetSafe360-WordPressVerifier/1.0';

export const LLMS_TXT_FIXER_ID = 'geo-llms-txt';
export const AI_SEARCH_ACCESS_FIXER_ID = 'geo-ai-search-access';
export const SITE_SCHEMA_FIXER_ID = 'geo-site-schema';

const SCHEMA_TYPE_BY_FINDING: Record<string, 'Organization' | 'WebSite'> = {
  'geo-organization-schema': 'Organization',
  'geo-website-schema': 'WebSite',
};

/** A fresh, uncached GET of a path on the site. */
async function fetchFresh(context: FixerVerifyContext, path: string, accept: string): Promise<Response> {
  const url = new URL(path, context.siteUrl);
  url.searchParams.set('gs360_verify', String(Date.now()));
  return (context.fetchImpl ?? fetch)(url.toString(), {
    redirect: 'follow',
    cache: 'no-store',
    headers: { Accept: accept, 'User-Agent': USER_AGENT },
  });
}

function failed(name: string, error: unknown, fallback: string): VerificationCheck {
  return { name, ok: false, detail: error instanceof Error ? error.message : fallback };
}

export const llmsTxtFixer: ConnectorFixer = {
  id: LLMS_TXT_FIXER_ID,
  executor: 'wp-connector',

  plan(findings, context) {
    if (!findings.some((finding) => finding.id === 'geo-llms-txt')) return null;
    const seo = context?.seo;
    // The web server answers before WordPress for a real file, and a subfolder install cannot answer at the root.
    // Without `seo` (connector < 1.12) the plan still forms, and the missing capability explains why it cannot run.
    if (seo && (seo.llmsFile || !seo.rootInstall)) return null;
    const content = context?.crawl ? buildLlmsTxt(context.crawl) : null;
    if (!content) return null;
    const pages = content.split('\n').filter((line) => line.startsWith('- [')).length;
    return {
      type: 'set_llms_txt',
      title: 'Publish llms.txt',
      description: `Serve /llms.txt with your site's name, summary and ${pages} page${pages === 1 ? '' : 's'}, taken from the pages we checked. Undo removes it again.`,
      risk: 'low',
      autoApplyEligible: true,
      requiresApproval: false,
      requiredCapabilities: ['llmsTxt'],
      verification: {
        kind: 'api',
        expectation: '/llms.txt answers 200 with a "# " title.',
        assertions: [content.split('\n')[0]],
      },
      payload: { content },
    };
  },

  toConnectorRequest(action) {
    const content = action.payload.content;
    if (typeof content !== 'string' || !content.startsWith('# ')) return null;
    const payload: WordPressLlmsTxtPayload = { content };
    return { id: action.id, type: 'set_llms_txt', payload };
  },

  async verify(context) {
    try {
      const response = await fetchFresh(context, '/llms.txt', 'text/plain');
      const text = response.ok ? await response.text() : '';
      const ok = response.ok && text.trimStart().startsWith('# ');
      return verificationResult([{
        name: 'llms-txt:served',
        ok,
        detail: ok
          ? `/llms.txt answers with "${text.split('\n')[0].slice(0, 80)}".`
          : `/llms.txt returned HTTP ${response.status}. A page cache or CDN may still serve the old answer.`,
      }]);
    } catch (error) {
      return verificationResult([failed('llms-txt:served', error, 'Could not reach /llms.txt.')]);
    }
  },
};

/** AI search crawlers the robots.txt the crawl saw keeps out. */
function blockedSearchCrawlers(robotsText: string): string[] {
  const robots = parseRobots(robotsText);
  return AI_CRAWLERS.filter((bot) => bot.purpose === 'search' && !isAllowed(robots, bot.agent)).map((bot) => bot.agent);
}

export const aiSearchAccessFixer: ConnectorFixer = {
  id: AI_SEARCH_ACCESS_FIXER_ID,
  executor: 'wp-connector',

  plan(findings, context) {
    if (!findings.some((finding) => finding.id === 'geo-ai-search-access')) return null;
    const seo = context?.seo;
    const robots = context?.crawl?.robots;
    if (seo && (seo.robotsFile || !seo.rootInstall || !seo.searchVisible)) return null;
    if (robots?.status !== 'ok' || !robots.text) return null;
    // A site that also keeps Google and Bing out means it: that is a decision, not an oversight.
    const parsed = parseRobots(robots.text);
    if (SEARCH_CRAWLERS.some((agent) => !isAllowed(parsed, agent))) return null;
    const blocked = blockedSearchCrawlers(robots.text);
    if (blocked.length === 0) return null;

    const rules = Object.fromEntries(blocked.map((agent) => [agent, 'allow' as const]));
    return {
      type: 'set_ai_crawler_rules',
      title: `Let ${blocked.length} AI search crawler${blocked.length === 1 ? '' : 's'} read the site`,
      description: `Allow ${blocked.join(', ')} in robots.txt so AI answer engines can find and cite your pages. They keep the private paths your robots.txt closes for everyone. AI training crawlers are not changed. Undo removes the rules.`,
      risk: 'low',
      autoApplyEligible: true,
      requiresApproval: false,
      requiredCapabilities: ['aiCrawlerRules'],
      verification: {
        kind: 'api',
        expectation: 'A fresh robots.txt allows each crawler.',
        assertions: blocked.map((agent) => `${agent}: allowed`),
      },
      payload: { rules },
    };
  },

  toConnectorRequest(action) {
    const rules = action.payload.rules;
    if (!rules || typeof rules !== 'object') return null;
    const known = new Set<string>(AI_CRAWLERS.map((bot) => bot.agent));
    const clean = Object.fromEntries(
      Object.entries(rules as Record<string, unknown>).filter(
        (entry): entry is [string, 'allow'] => known.has(entry[0]) && entry[1] === 'allow',
      ),
    );
    if (Object.keys(clean).length === 0) return null;
    const payload: WordPressAiCrawlerRulesPayload = { rules: clean };
    return { id: action.id, type: 'set_ai_crawler_rules', payload };
  },

  async verify(context) {
    const agents = Object.keys((context.action.payload.rules ?? {}) as Record<string, unknown>);
    try {
      const response = await fetchFresh(context, '/robots.txt', 'text/plain');
      const robots = parseRobots(response.ok ? await response.text() : '');
      return verificationResult(agents.map((agent) => {
        const ok = response.ok && isAllowed(robots, agent);
        return {
          name: `robots-txt:${agent.toLowerCase()}`,
          ok,
          detail: ok ? `${agent} may read the site.` : `robots.txt still keeps ${agent} out. A page cache or CDN may still serve the old file.`,
        };
      }));
    } catch (error) {
      return verificationResult([failed('robots-txt:fetch', error, 'Could not reach robots.txt.')]);
    }
  },
};

export const siteSchemaFixer: ConnectorFixer = {
  id: SITE_SCHEMA_FIXER_ID,
  executor: 'wp-connector',

  plan(findings, context) {
    const types = [...new Set(findings.map((finding) => SCHEMA_TYPE_BY_FINDING[finding.id]).filter(Boolean))];
    const seo = context?.seo;
    // Yoast, Rank Math & co. write this graph themselves; a second one would duplicate it.
    if (types.length === 0 || (seo && seo.seoPlugin !== null)) return null;
    return {
      type: 'set_schema',
      title: `Add ${types.join(' and ')} schema`,
      description: `Describe your ${types.includes('Organization') ? 'business' : 'website'} to search and AI engines on the home page, from the site name, logo and tagline set in WordPress. Undo removes it.`,
      risk: 'low',
      autoApplyEligible: true,
      requiresApproval: false,
      requiredCapabilities: ['schemaGaps'],
      verification: {
        kind: 'api',
        expectation: 'The home page carries the schema types.',
        assertions: types.map((type) => `@type ${type}`),
      },
      payload: { types },
    };
  },

  toConnectorRequest(action) {
    const types = Array.isArray(action.payload.types)
      ? action.payload.types.filter((type): type is 'Organization' | 'WebSite' => type === 'Organization' || type === 'WebSite')
      : [];
    if (types.length === 0) return null;
    const payload: WordPressSchemaPayload = { types };
    return { id: action.id, type: 'set_schema', payload };
  },

  async verify(context) {
    const types = (Array.isArray(context.action.payload.types) ? context.action.payload.types : []) as string[];
    try {
      const response = await fetchFresh(context, '/', 'text/html');
      const html = response.ok ? await response.text() : '';
      const found = new Set(parseSeoPage(html, context.siteUrl).schema.types);
      return verificationResult(types.map((type) => ({
        name: `schema:${type.toLowerCase()}`,
        ok: found.has(type),
        detail: found.has(type) ? `The home page carries ${type} schema.` : `${type} schema is not on the home page yet. A page cache may still serve the old page.`,
      })));
    } catch (error) {
      return verificationResult([failed('schema:fetch', error, 'Could not reach the home page.')]);
    }
  },
};
