// app/(dashboard)/dashboard/sites/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { list, type ListBlobResultBlob } from "@vercel/blob";
import Link from "next/link";
export const experimental_ppr = true;

type SiteRow = {
  siteId: string;
  siteUrl: string;
  status: string;
  createdAt: number; // ms epoch
};

function keyOf(b: ListBlobResultBlob) {
  // SDK exposes pathname (e.g. "sites/<id>.json")
  // Fallback to URL parsing just in case.
  return b.pathname ?? new URL(b.url).pathname.replace(/^\/+/, "");
}

function fileIdFromKey(key: string) {
  return key.replace(/^sites\//, "").replace(/\.json$/i, "");
}

function toMillis(u: unknown) {
  if (u instanceof Date) return u.getTime();
  if (typeof u === "number") return u;
  const t = Date.parse(String(u ?? ""));
  return Number.isFinite(t) ? t : Date.now();
}

// Normalize one blob JSON into a SiteRow (or null if invalid)
async function normalizeBlobToSiteRow(b: ListBlobResultBlob): Promise<SiteRow | null> {
  const key = keyOf(b);
  const res = await fetch(b.url, { cache: "no-store" });
  if (!res.ok) return null;

  const j = await res.json().catch(() => null) as any;
  if (!j || typeof j !== "object") return null;

  const siteId = j.siteId ?? fileIdFromKey(key);
  const siteUrl = j.siteUrl ?? j.url ?? "";
  const status = j.status ?? (j.tokenHash ? "connected" : "unknown");
  const createdAt =
    typeof j.createdAt === "number" ? j.createdAt : toMillis(b.uploadedAt);

  if (!siteId || !siteUrl) return null;
  return { siteId, siteUrl, status, createdAt };
}

async function getSites(): Promise<{ rows: SiteRow[]; hidden: number }> {
  const { blobs } = await list({ prefix: "sites/" });
  const rowsRaw = await Promise.all(blobs.map((b) => normalizeBlobToSiteRow(b)));
  const rows = rowsRaw.filter(Boolean) as SiteRow[];
  const hidden = rowsRaw.length - rows.length;

  rows.sort((a, b) => b.createdAt - a.createdAt);
  return { rows, hidden };
}

function siteKey(s: SiteRow, index: number) {
  return `${s.siteId}::${s.siteUrl}::${s.createdAt}::${index}`;
}

export default async function SitesIndex() {
  const { rows: sites, hidden } = await getSites();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Your Sites</h1>
        <Link
          href="/dashboard/sites/connect"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-600 text-white"
        >
          + Connect site
        </Link>
      </div>

      {hidden > 0 && (
        <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          {hidden} legacy entries hidden (missing siteId or siteUrl).
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {sites.map((s, idx) => (
          <Link
            key={siteKey(s, idx)}
            href={`/dashboard/sites/${encodeURIComponent(s.siteId)}`}
            className="border rounded-lg p-4 hover:bg-white/5"
          >
            <div className="text-sm text-slate-500">
              {new Date(s.createdAt).toLocaleString()}
            </div>
            <div className="text-lg font-medium">{s.siteUrl}</div>
            <div className="text-xs uppercase tracking-wide opacity-70">{s.status}</div>
          </Link>
        ))}

        {sites.length === 0 && (
          <div className="text-slate-500">No sites yet. Connect your first site.</div>
        )}
      </div>
    </div>
  );
}
