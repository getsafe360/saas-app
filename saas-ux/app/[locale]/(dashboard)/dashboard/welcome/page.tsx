// app/(dashboard)/dashboard/welcome/page.tsx
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
export const runtime = "nodejs";
export const experimental_ppr = true;

async function fetchStashViaUrl(publicUrl: string) {
  const r = await fetch(publicUrl, { cache: "no-store" });
  if (!r.ok) return null;
  return r.json();
}

/** Optional fallback if you’d rather compose a URL from a base */
function buildPublicUrlFromKey(key: string) {
  const base = process.env.NEXT_PUBLIC_BLOB_BASE_URL || process.env.BLOB_PUBLIC_BASE;
  // e.g. NEXT_PUBLIC_BLOB_BASE_URL="https://<your-public-id>.public.blob.vercel-storage.com/"
  if (!base) return null;
  // new URL handles slashes gracefully
  return new URL(key, base).toString();
}

async function saveSiteForUser(userId: string, seed: any) {
  const { put } = await import("@vercel/blob");
  const key = `sites/${userId}/${crypto.randomUUID()}.json`;
  const res = await put(key, JSON.stringify({
    userId,
    url: seed.url,
    scores: seed.scores,
    screenshotUrl: seed.screenshotUrl,
    faviconUrl: seed.faviconUrl,
    cms: seed.cms ?? null,
    createdAt: Date.now(),
  }), { access: "public", contentType: "application/json" });
  return { key, privateUrl: res.url };
}

export default async function WelcomePage({
  searchParams,
}: {
  // ✅ In Next 15+, searchParams is a Promise
  searchParams: Promise<{ stash?: string; u?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const sp = await searchParams;                    // ✅ await it
  const stashKey = sp?.stash;
  const stashUrl = sp?.u;                           // public blob URL (preferred)

  if (!stashKey && !stashUrl) {
    redirect("/dashboard/sites?first=1");
  }

  // Prefer the direct public URL we passed from the CTA
  let stash: any = null;
  if (stashUrl) {
    stash = await fetchStashViaUrl(stashUrl);
  } else if (stashKey) {
    const composed = buildPublicUrlFromKey(stashKey);
    if (!composed) {
      // If you don’t want to expose a public base, you can switch to Blob SDK “get” here instead.
      // For now we bail out to the sites page.
      redirect("/dashboard/sites?first=1");
    }
    stash = await fetchStashViaUrl(composed!);
  }

  if (!stash) {
    redirect("/dashboard/sites?first=1");
  }

  await saveSiteForUser(user.id, stash);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Welcome to GetSafe 360</h1>
      <p className="text-slate-300">
        We’ve imported your first site from the analyzer. Next, connect your site for
        <b> instant optimization</b>.
      </p>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3 mb-4">
          {stash.faviconUrl ? (
            <img src={stash.faviconUrl} alt="" width={20} height={20} className="rounded-sm" />
          ) : null}
          <div className="text-slate-200">{stash.url}</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {stash.screenshotUrl ? (
            <img
              src={stash.screenshotUrl}
              alt="site preview"
              className="rounded-lg border border-white/10 w-full h-auto"
            />
          ) : null}
          <div className="text-sm text-slate-300 space-y-2">
            <div>CMS: <span className="text-slate-100">{stash.cms ?? "Unknown"}</span></div>
            <div>SEO: {stash.scores?.SEO ?? 0}</div>
            <div>Performance: {stash.scores?.Performance ?? 0}</div>
            <div>Accessibility: {stash.scores?.Accessibility ?? 0}</div>
            <div>Security: {stash.scores?.Security ?? 0}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={`/dashboard/sites/connect?url=${encodeURIComponent(stash.url)}`}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-semibold"
          >
            Connect WordPress
          </a>
          <a
            href="/dashboard/sites"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-white/15 text-slate-200 hover:bg-white/5"
          >
            Go to your sites
          </a>
        </div>
      </div>
    </div>
  );
}