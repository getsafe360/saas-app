// app/api/connect/provision/route.ts
// Generates and returns JS snippet token + API key for non-WP connection methods.
// Tokens are derived via HMAC-SHA256 so they're deterministic and don't need DB storage.
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDrizzle } from '@/lib/db/postgres';
import { users } from '@/lib/db/schema/auth/users';
import { sites } from '@/lib/db/schema/sites';
import { and, eq } from 'drizzle-orm';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const PROVISION_SECRET = process.env.PROVISION_SECRET;

function hmac(value: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function snippetToken(siteId: string, secret: string) {
  return hmac(`snippet:${siteId}`, secret);
}

function apiKeyToken(siteId: string, secret: string) {
  return hmac(`apikey:${siteId}`, secret);
}

function buildSnippet(siteId: string, token: string): string {
  return `<script>
(function(){
  window.__gs360={siteId:"${siteId}",token:"${token}",v:"1"};
  var s=document.createElement("script");
  s.src="https://cdn.getsafe360.com/monitor.min.js";
  s.async=true;
  document.head.appendChild(s);
})();
</script>`;
}

// GET /api/connect/provision?siteId=...
export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const db = getDrizzle();
  const [dbUser] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  if (!dbUser) return NextResponse.json({ error: 'user not found' }, { status: 401 });

  const [site] = await db
    .select({ id: sites.id, siteUrl: sites.siteUrl })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, dbUser.id)))
    .limit(1);
  if (!site) return NextResponse.json({ error: 'site not found' }, { status: 404 });

  if (!PROVISION_SECRET) {
    console.error('[provision] PROVISION_SECRET env var is not set');
    return NextResponse.json({ error: 'server_misconfiguration' }, { status: 500 });
  }

  const token = snippetToken(siteId, PROVISION_SECRET);
  const apiKey = apiKeyToken(siteId, PROVISION_SECRET);

  // 7-day uptime: read from Redis connection log
  const uptimeKey = `uptime:${siteId}`;
  const uptimeRaw = await redis.get<string>(uptimeKey).catch(() => null);
  let uptime7d: (0 | 1)[] = [1, 1, 1, 1, 1, 1, 1];
  if (uptimeRaw) {
    try {
      const parsed = typeof uptimeRaw === 'string' ? JSON.parse(uptimeRaw) : uptimeRaw;
      if (Array.isArray(parsed)) uptime7d = parsed.slice(-7);
    } catch { /* use default */ }
  }

  return NextResponse.json({
    token,
    apiKey,
    snippet: buildSnippet(siteId, token),
    uptime7d,
  });
}

// POST /api/connect/provision — record a successful snippet/apikey connection
export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { siteId, method } = body as { siteId?: string; method?: string };
  if (!siteId || !method) return NextResponse.json({ error: 'siteId and method required' }, { status: 400 });

  // Verify ownership
  const db = getDrizzle();
  const [dbUser] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  if (!dbUser) return NextResponse.json({ error: 'user not found' }, { status: 401 });
  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.userId, dbUser.id)))
    .limit(1);
  if (!site) return NextResponse.json({ error: 'site not found' }, { status: 404 });

  await redis.set(`provision:method:${siteId}`, method, { ex: 365 * 24 * 3600 });
  return NextResponse.json({ ok: true });
}
