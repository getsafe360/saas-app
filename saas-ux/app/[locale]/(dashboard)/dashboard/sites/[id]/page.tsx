// app/[locale]/(dashboard)/dashboard/sites/[id]/page.tsx
import { getDb } from '@/lib/db/drizzle';
import { sites } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { list, type ListBlobResultBlob } from '@vercel/blob';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import type { Metadata } from 'next';
const DEFAULT_LOCALE = 'en';

type SiteRecord = {
  siteId: string;
  siteUrl: string;
  status: string;
  wpVersion?: string | null;
  pluginVersion?: string | null;
  createdAt: number;
  updatedAt: number;
};

// params is a Promise and contains both locale & id in this route
export async function generateMetadata(
  { params }: { params: Promise<{ locale: string; id: string }> }
): Promise<Metadata> {
  const { id, locale } = await params;

  // locale-aware translations
  const t = await getTranslations({ locale, namespace: 'Sites' });

  // Try DB first (good when your sites table is populated)
  let siteUrl: string | null = null;
  try {
    const db = getDb();
    // Select only the needed column to avoid accidental type issues
    const [row] = await db
      .select({ siteUrl: sites.siteUrl })
      .from(sites)
      .where(eq(sites.id, id))
      .limit(1);
    siteUrl = row?.siteUrl ?? null;
  } catch {
    // ignore DB errors in metadata
  }

  // Fallback to Blob if DB record is missing (keeps metadata in sync with the page)
  if (!siteUrl) {
    const blobSite = await getSite(id);
    siteUrl = blobSite?.siteUrl ?? null;
  }

  const title = siteUrl ? t('detailTitle', { url: siteUrl }) : t('notFoundTitle');
  const description = siteUrl
    ? t('detailDescription', { url: siteUrl })
    : t('notFoundDescription');

  const path = `/dashboard/sites/${id}`;
  const canonicalPath = locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalPath
    },
    alternates: {
      canonical: canonicalPath
    }
  };
}

async function getSite(id: string): Promise<SiteRecord | null> {
  const { blobs } = await list({ prefix: `sites/${id}.json` });
  const b = blobs[0];
  if (!b) return null;
  const r = await fetch(b.url, { cache: 'no-store' });
  const j = await r.json().catch(() => null);
  if (!j || !j.siteId || !j.siteUrl) return null;
  return j as SiteRecord;
}

async function getFaviconUrl(siteId: string): Promise<string | null> {
  const { blobs } = await list({ prefix: `favicons/${siteId}` });
  const b = blobs[0] as ListBlobResultBlob | undefined;
  return b?.url ?? null;
}

async function getRecentScreenshots(siteId: string): Promise<string[]> {
  const { blobs } = await list({ prefix: `screenshots/${siteId}/` });
  return blobs
    .sort((a, b) => {
      const ta = a.uploadedAt instanceof Date ? a.uploadedAt.getTime() : Date.now();
      const tb = b.uploadedAt instanceof Date ? b.uploadedAt.getTime() : Date.now();
      return tb - ta;
    })
    .slice(0, 4)
    .map(b => b.url);
}

function hostnameOf(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
}
function initials(host: string) {
  const parts = host.split('.');
  const core = parts[parts.length - 2] || parts[0] || '';
  const s = core.replace(/[^a-zA-Z0-9]/g, '');
  return s.slice(0, 2).toUpperCase() || 'S';
}

export default async function SiteDetail({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = (searchParams ? await searchParams : {}) ?? {};
  const justConnected =
    Array.isArray(sp.connected) ? sp.connected[0] === '1' : sp.connected === '1';
  const site = await getSite(id);
  if (!site) return notFound();

  const host = hostnameOf(site.siteUrl);
  const fav = await getFaviconUrl(site.siteId);
  const shots = await getRecentScreenshots(site.siteId);

  return (
    <div className="p-6 space-y-6">
      {justConnected && (
        <div className="rounded-lg border p-3 bg-green-50 text-green-800">
          ✅ Connected! You can run a full scan now.
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {fav ? (
            <img src={fav} alt={`${host} favicon`} className="h-10 w-10 rounded-md border" />
          ) : (
            <div className="h-10 w-10 rounded-md border border-blue-500/50 bg-blue-800/90 flex items-center justify-center font-semibold">
              {initials(host)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{host}</h1>
              <StatusBadge status={site.status} />
            </div>
            <div className="text-slate-500 text-sm">{site.siteUrl}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/sites/${site.siteId}/analyze`}
            className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700"
          >
            Run full scan
          </Link>
          <Link
            href={`/dashboard/sites/connect?url=${encodeURIComponent(site.siteUrl)}`}
            className="px-4 py-2 rounded-full border border-slate-300 hover:bg-white/50"
          >
            Reconnect
          </Link>
        </div>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 md:col-span-2">
          <div className="font-semibold mb-2">Connection</div>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="text-slate-500">Status</div>
            <div>{site.status}</div>
            <div className="text-slate-500">WP Version</div>
            <div>{site.wpVersion ?? "—"}</div>
            <div className="text-slate-500">Plugin</div>
            <div>{site.pluginVersion ?? "—"}</div>
            <div className="text-slate-500">Site ID</div>
            <div className="font-mono">{site.siteId}</div>
            <div className="text-slate-500">Connected</div>
            <div>{new Date(site.createdAt).toLocaleString()}</div>
            <div className="text-slate-500">Updated</div>
            <div>{new Date(site.updatedAt).toLocaleString()}</div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="font-semibold mb-2">Next step</div>
          <p className="text-sm text-slate-600">
            We’ll pull a quick snapshot and then offer instant repairs with estimated token cost.
          </p>
          <div className="mt-3">
            <Link
              href={`/dashboard/sites/${site.siteId}/analyze`}
              className="w-full inline-flex justify-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Start scan
            </Link>
          </div>
        </div>
      </div>

      {/* Recent screenshots (optional eye-candy) */}
      {shots.length > 0 && (
        <div>
          <div className="font-semibold mb-2">Recent screenshots</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {shots.map((u, i) => (
              <div key={`${u}::${i}`} className="rounded-lg overflow-hidden border">
                <img src={u} alt={`Screenshot ${i + 1}`} className="w-full h-32 object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
