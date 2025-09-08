export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { list } from "@vercel/blob";
import { notFound } from "next/navigation";
import Link from "next/link";

async function getSite(id: string) {
  const { blobs } = await list({ prefix: `sites/${id}.json` });
  const b = blobs[0];
  if (!b) return null;
  const r = await fetch(b.url, { cache: "no-store" });
  return r.json().catch(() => null);
}

export default async function SiteDetail({
  params,
  searchParams,
}: {
  // works in both old/new Next versions
  params: { id: string } | Promise<{ id: string }>;
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
  // ✅ await params (it might be a Promise)
  const { id } = await params;

  // ✅ searchParams may also be a Promise; normalize it to an object
  const sp = await Promise.resolve(searchParams ?? {});
  const connectedParam = sp.connected;
  const justConnected = Array.isArray(connectedParam)
    ? connectedParam[0] === "1"
    : connectedParam === "1";

  const site = await getSite(id);
  if (!site) return notFound();

  return (
    <div className="p-6 space-y-4">
      {justConnected && (
        <div className="rounded-lg border p-3 bg-green-50 text-green-800">
          ✅ Connected! You can run a full scan now.
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{site.siteUrl}</h1>
          <div className="text-sm text-slate-500">Site ID: {site.siteId}</div>
        </div>
        <Link
          href={`/dashboard/sites/${site.siteId}/analyze`}
          className="px-4 py-2 rounded-full bg-indigo-600 text-white"
        >
          Run full scan
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <div className="font-semibold mb-1">Connection</div>
          <div className="text-sm">Status: {site.status}</div>
          <div className="text-sm">WP Version: {site.wpVersion ?? "—"}</div>
          <div className="text-sm">Plugin: {site.pluginVersion ?? "—"}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="font-semibold mb-1">Next step</div>
          <div className="text-sm">
            We’ll pull a quick snapshot and then offer instant repairs with estimated token cost.
          </div>
        </div>
      </div>
    </div>
  );
}

