// lib/seo/store.ts
//
// The latest SEO/GEO crawl per site, plus a short score history for
// before/after comparisons. Kept in Redis for 90 days.

import 'server-only';

import { getRedis } from '@/lib/api/redis';
import type { SeoCrawl } from '@/lib/engine/seo/facts';

const TTL_SECONDS = 90 * 24 * 60 * 60;
const HISTORY = 30;
const latestKey = (siteId: string) => `seo-geo:${siteId}:latest`;
const historyKey = (siteId: string) => `seo-geo:${siteId}:history`;

export interface SeoScorePoint {
  checkedAt: string;
  geo: number | null;
  seo: number | null;
}

export async function saveCrawl(siteId: string, crawl: SeoCrawl, scores: Omit<SeoScorePoint, 'checkedAt'>): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const point: SeoScorePoint = { checkedAt: crawl.checkedAt, ...scores };
  await redis
    .pipeline()
    .set(latestKey(siteId), JSON.stringify(crawl), { ex: TTL_SECONDS })
    .lpush(historyKey(siteId), JSON.stringify(point))
    .ltrim(historyKey(siteId), 0, HISTORY - 1)
    .expire(historyKey(siteId), TTL_SECONDS)
    .exec();
}

export async function loadCrawl(siteId: string): Promise<SeoCrawl | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get<SeoCrawl | string>(latestKey(siteId));
  if (!raw) return null;
  return typeof raw === 'string' ? (JSON.parse(raw) as SeoCrawl) : raw;
}

export async function loadScoreHistory(siteId: string): Promise<SeoScorePoint[]> {
  const redis = getRedis();
  if (!redis) return [];
  const rows = await redis.lrange<SeoScorePoint | string>(historyKey(siteId), 0, HISTORY - 1);
  return rows.map((row) => (typeof row === 'string' ? (JSON.parse(row) as SeoScorePoint) : row));
}
