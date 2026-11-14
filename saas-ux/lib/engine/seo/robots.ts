// lib/engine/seo/robots.ts
//
// robots.txt as crawlers read it (RFC 9309): groups of user-agent lines with
// allow/disallow rules; a crawler obeys the most specific group naming it,
// else the "*" group; within a group the longest matching rule wins and allow
// wins a tie. Used to tell which AI crawlers may read a site.

export interface RobotsGroup {
  agents: string[];
  rules: Array<{ allow: boolean; path: string }>;
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
}

/** AI crawlers and what they do. `search` bots fetch pages to answer and cite live questions. */
export const AI_CRAWLERS = [
  { agent: 'OAI-SearchBot', owner: 'OpenAI', purpose: 'search' },
  { agent: 'ChatGPT-User', owner: 'OpenAI', purpose: 'search' },
  { agent: 'GPTBot', owner: 'OpenAI', purpose: 'training' },
  { agent: 'Claude-SearchBot', owner: 'Anthropic', purpose: 'search' },
  { agent: 'Claude-User', owner: 'Anthropic', purpose: 'search' },
  { agent: 'ClaudeBot', owner: 'Anthropic', purpose: 'training' },
  { agent: 'PerplexityBot', owner: 'Perplexity', purpose: 'search' },
  { agent: 'Perplexity-User', owner: 'Perplexity', purpose: 'search' },
  { agent: 'Google-Extended', owner: 'Google', purpose: 'training' },
  { agent: 'Applebot-Extended', owner: 'Apple', purpose: 'training' },
  { agent: 'CCBot', owner: 'Common Crawl', purpose: 'training' },
  { agent: 'Meta-ExternalAgent', owner: 'Meta', purpose: 'training' },
  { agent: 'Bytespider', owner: 'ByteDance', purpose: 'training' },
] as const;

export type AiCrawler = (typeof AI_CRAWLERS)[number];

/** Classic search engines; a site that blocks these has a bigger problem than GEO. */
export const SEARCH_CRAWLERS = ['Googlebot', 'Bingbot'] as const;

const MAX_BYTES = 500_000;

export function parseRobots(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  // Consecutive user-agent lines share one group; a rule line closes the agent list.
  let collectingAgents = false;

  for (const raw of text.slice(0, MAX_BYTES).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === 'user-agent') {
      if (!collectingAgents || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
        collectingAgents = true;
      }
      if (value) current.agents.push(value.toLowerCase());
    } else if (field === 'allow' || field === 'disallow') {
      collectingAgents = false;
      // Rules before any user-agent line belong to no group.
      if (!current) continue;
      // An empty disallow allows everything; it adds no rule.
      if (field === 'disallow' && value === '') continue;
      current.rules.push({ allow: field === 'allow', path: value });
    } else if (field === 'sitemap') {
      if (value) sitemaps.push(value);
    } else {
      collectingAgents = false;
    }
  }
  return { groups, sitemaps };
}

/** Groups that name the crawler (whole token, any case), else the "*" groups. */
function groupFor(robots: ParsedRobots, agent: string): RobotsGroup[] {
  const name = agent.toLowerCase();
  const named = robots.groups.filter((group) => group.agents.includes(name));
  if (named.length > 0) return named;
  return robots.groups.filter((group) => group.agents.includes('*'));
}

/** robots.txt path pattern: "*" matches any run of characters, a trailing "$" anchors the end. */
function patternMatches(pattern: string, path: string): boolean {
  if (pattern === '') return false;
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = new RegExp(
    '^' + body.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : ''),
  );
  return regex.test(path);
}

/** Whether `agent` may fetch `path` (default "/"). No matching group or rule means allowed. */
export function isAllowed(robots: ParsedRobots, agent: string, path = '/'): boolean {
  let best: { allow: boolean; length: number } | null = null;
  for (const group of groupFor(robots, agent)) {
    for (const rule of group.rules) {
      if (!patternMatches(rule.path, path)) continue;
      const length = rule.path.length;
      if (!best || length > best.length || (length === best.length && rule.allow && !best.allow)) {
        best = { allow: rule.allow, length };
      }
    }
  }
  return best ? best.allow : true;
}
