// lib/security/csp/reports.ts
//
// CSP violation reports sent by visitors' browsers. Each site gets an
// unguessable report address; per report we keep only the directive, the
// blocked source (an origin or a keyword such as 'inline'), a count and one
// sample page path. Counts live in Redis for 30 days.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getRedis } from '@/lib/api/redis';

const TTL_SECONDS = 30 * 24 * 3600;
const MAX_ENTRIES = 300;
const IGNORED_SCHEMES = /^(?:chrome|moz|safari|safari-web|ms-browser|edge)-extension:|^about:|^chrome:|^resource:/i;
const DIRECTIVE_ALIASES: Record<string, string> = {
  'script-src-elem': 'script-src',
  'script-src-attr': 'script-src',
  'style-src-elem': 'style-src',
  'style-src-attr': 'style-src',
};

function secret(): string {
  const value = process.env.CSP_REPORT_SECRET ?? process.env.CLERK_SECRET_KEY;
  if (!value) throw new Error('CSP_REPORT_SECRET is not configured.');
  return value;
}

export function reportKey(siteId: string): string {
  return createHmac('sha256', secret()).update(`csp-report:${siteId}`).digest('hex').slice(0, 32);
}

export function isValidReportKey(siteId: string, key: string): boolean {
  if (!/^[a-f0-9]{32}$/.test(key)) return false;
  const expected = Buffer.from(reportKey(siteId));
  return timingSafeEqual(expected, Buffer.from(key));
}

export function reportBaseUrl(): string {
  return (process.env.BASE_URL ?? 'https://www.getsafe360.ai').replace(/\/$/, '');
}

export function reportUriFor(siteId: string): string {
  return `${reportBaseUrl()}/api/csp-report/${siteId}/${reportKey(siteId)}`;
}

export interface CspViolation {
  directive: string;
  blocked: string;
  page: string;
}

function blockedSource(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value === '' || value === 'inline') return "'inline'";
  if (value === 'eval' || value === 'wasm-eval') return `'${value}'`;
  if (IGNORED_SCHEMES.test(value)) return null;
  if (/^(?:data|blob|mediastream)(?::|$)/i.test(value)) return `${value.split(':')[0].toLowerCase()}:`;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'wss:' && url.protocol !== 'ws:') return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function pagePath(raw: unknown): string {
  try {
    return new URL(String(raw)).pathname.slice(0, 200) || '/';
  } catch {
    return '/';
  }
}

/** Accepts both the report-uri format and the Reporting API format; ignores extension noise. */
export function normalizeReports(body: unknown): CspViolation[] {
  const entries: Array<Record<string, unknown>> = [];
  if (Array.isArray(body)) {
    for (const item of body) {
      if (item && typeof item === 'object' && (item as { type?: unknown }).type === 'csp-violation') {
        const inner = (item as { body?: unknown }).body;
        if (inner && typeof inner === 'object') entries.push(inner as Record<string, unknown>);
      }
    }
  } else if (body && typeof body === 'object' && 'csp-report' in body) {
    const inner = (body as Record<string, unknown>)['csp-report'];
    if (inner && typeof inner === 'object') entries.push(inner as Record<string, unknown>);
  }

  const out: CspViolation[] = [];
  for (const entry of entries.slice(0, 20)) {
    const rawDirective = String(entry.effectiveDirective ?? entry['effective-directive'] ?? entry['violated-directive'] ?? '')
      .trim()
      .split(/\s+/)[0]
      .toLowerCase();
    if (!/^[a-z-]{3,30}$/.test(rawDirective)) continue;
    const blocked = blockedSource(entry.blockedURL ?? entry['blocked-uri']);
    if (!blocked) continue;
    out.push({
      directive: DIRECTIVE_ALIASES[rawDirective] ?? rawDirective,
      blocked,
      page: pagePath(entry.documentURL ?? entry['document-uri']),
    });
  }
  return out;
}

// ---------- storage ----------

const keys = (siteId: string) => ({ counts: `csp:${siteId}:counts`, pages: `csp:${siteId}:pages`, state: `csp:${siteId}:state` });
const memory = new Map<string, Map<string, string>>();
const memHash = (key: string) => {
  let hash = memory.get(key);
  if (!hash) memory.set(key, (hash = new Map()));
  return hash;
};

type RedisClient = NonNullable<ReturnType<typeof getRedis>>;

export async function storeViolations(
  siteId: string,
  violations: ReadonlyArray<CspViolation>,
  redis: Pick<RedisClient, 'hlen' | 'pipeline'> | null = getRedis(),
): Promise<void> {
  if (violations.length === 0) return;
  const k = keys(siteId);
  if (!redis) {
    const counts = memHash(k.counts);
    const pages = memHash(k.pages);
    for (const v of violations) {
      const field = `${v.directive} ${v.blocked}`;
      if (!counts.has(field) && counts.size >= MAX_ENTRIES) continue;
      counts.set(field, String(Number(counts.get(field) ?? 0) + 1));
      if (!pages.has(field)) pages.set(field, v.page);
    }
    return;
  }
  // One entry per source in this batch, so the cap below is checked once per field.
  const batch = new Map<string, { count: number; page: string }>();
  for (const v of violations) {
    const field = `${v.directive} ${v.blocked}`;
    const entry = batch.get(field);
    if (entry) entry.count += 1;
    else batch.set(field, { count: 1, page: v.page });
  }
  const fields = [...batch.keys()];
  let size = await redis.hlen(k.counts);
  // Known sources always keep counting; new ones are admitted only while the list
  // has room. Concurrent requests can overshoot by at most one batch.
  // With room for every field, treat them all as admitted.
  let known: Set<string> = new Set(fields);
  if (size + fields.length > MAX_ENTRIES) {
    const check = redis.pipeline();
    for (const field of fields) check.hexists(k.counts, field);
    const exists = (await check.exec()) as unknown[];
    known = new Set(fields.filter((_, index) => Number(exists[index]) === 1));
  }
  const pipeline = redis.pipeline();
  for (const [field, { count, page }] of batch) {
    if (!known.has(field)) {
      if (size >= MAX_ENTRIES) continue;
      size += 1;
    }
    pipeline.hincrby(k.counts, field, count);
    pipeline.hsetnx(k.pages, field, page);
  }
  pipeline.expire(k.counts, TTL_SECONDS);
  pipeline.expire(k.pages, TTL_SECONDS);
  await pipeline.exec();
}

export interface CspViolationSummary {
  directive: string;
  blocked: string;
  count: number;
  page: string | null;
}

export async function readViolations(siteId: string): Promise<CspViolationSummary[]> {
  const k = keys(siteId);
  const redis = getRedis();
  const counts: Record<string, unknown> = redis ? ((await redis.hgetall(k.counts)) ?? {}) : Object.fromEntries(memHash(k.counts));
  const pages: Record<string, unknown> = redis ? ((await redis.hgetall(k.pages)) ?? {}) : Object.fromEntries(memHash(k.pages));
  return Object.entries(counts)
    .map(([field, count]) => {
      const space = field.indexOf(' ');
      return {
        directive: field.slice(0, space),
        blocked: field.slice(space + 1),
        count: Number(count) || 0,
        page: typeof pages[field] === 'string' ? (pages[field] as string) : null,
      };
    })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
}

export interface CspTestState {
  /** report-only: the test (phase 1). enforced: the policy is switched on (phase 2). */
  mode: 'report-only' | 'enforced';
  policy: string;
  startedAt: string;
  runId: string | null;
}

export async function saveTestState(siteId: string, state: CspTestState): Promise<void> {
  const k = keys(siteId);
  const redis = getRedis();
  const value = JSON.stringify(state);
  if (!redis) {
    memHash(k.state).set('value', value);
    return;
  }
  // A new test starts with an empty report list.
  await redis.del(k.counts, k.pages);
  await redis.set(k.state, value, { ex: 90 * 24 * 3600 });
}

export async function readTestState(siteId: string): Promise<CspTestState | null> {
  const k = keys(siteId);
  const redis = getRedis();
  const raw = redis ? await redis.get<unknown>(k.state) : memHash(k.state).get('value');
  if (!raw) return null;
  try {
    const value = (typeof raw === 'string' ? JSON.parse(raw) : raw) as CspTestState;
    return value && typeof value.policy === 'string' ? value : null;
  } catch {
    return null;
  }
}

export async function clearTestState(siteId: string): Promise<void> {
  const k = keys(siteId);
  const redis = getRedis();
  if (!redis) {
    memory.delete(k.state);
    memory.delete(k.counts);
    memory.delete(k.pages);
    return;
  }
  await redis.del(k.state, k.counts, k.pages);
}
