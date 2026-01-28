// app/(dashboard)/dashboard/welcome/page.tsx
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { WelcomeClient } from "./WelcomeClient";
import { getDb } from "@/lib/db/drizzle";
import { sites } from "@/lib/db/schema/sites";
import type { StashedTestResult } from "@/lib/stash/types";
import { getOrCreateAppUserId } from "@/lib/auth/sync-clerk-user";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

async function fetchStashViaUrl(publicUrl: string): Promise<StashedTestResult | null> {
  try {
    console.log("[fetchStashViaUrl] Attempting to fetch:", publicUrl);
    const r = await fetch(publicUrl, { cache: "no-store" });
    console.log("[fetchStashViaUrl] Fetch response status:", r.status, r.statusText);

    if (!r.ok) {
      console.error("[fetchStashViaUrl] Fetch failed with status:", r.status);
      return null;
    }

    const data = await r.json();
    console.log("[fetchStashViaUrl] Successfully parsed JSON, data keys:", Object.keys(data));
    return data as StashedTestResult;
  } catch (error) {
    console.error("[fetchStashViaUrl] Exception during fetch:", error);
    return null;
  }
}

function buildPublicUrlFromKey(key: string) {
  const base =
    process.env.NEXT_PUBLIC_BLOB_BASE_URL || process.env.BLOB_PUBLIC_BASE;
  if (!base) return null;
  return new URL(key, base).toString();
}

async function saveSiteToDatabase(
  appUserId: number,
  stash: StashedTestResult
): Promise<string | null> {
  try {
    const db = getDb();

    // Extract domain from URL
    const urlObj = new URL(stash.url);
    const domain = urlObj.hostname;
    const canonicalHost = domain; // Use full hostname as canonical_host
    const canonicalRoot = urlObj.origin;

    console.log("[saveSiteToDatabase] Extracted:", { domain, canonicalHost, canonicalRoot });

    // Check if site already exists for this user and host
    const [existingSite] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(
        and(
          eq(sites.userId, appUserId),
          eq(sites.canonicalHost, canonicalHost)
        )
      )
      .limit(1);

    if (existingSite) {
      console.log("[saveSiteToDatabase] Site already exists, updating:", existingSite.id);

      // Update existing site
      await db
        .update(sites)
        .set({
          siteUrl: stash.url,
          status: "connected",
          cms: stash.facts?.cms?.type || null,
          lastScores: stash.scores ? JSON.stringify(stash.scores) : null,
          lastFaviconUrl: stash.facts?.faviconUrl || null,
          updatedAt: new Date(),
        } as any)
        .where(eq(sites.id, existingSite.id));

      // Update blob storage (optional, just a cache)
      try {
        const { put } = await import("@vercel/blob");
        const blobKey = `sites/${existingSite.id}.json`;
        await put(
          blobKey,
          JSON.stringify({
            siteId: existingSite.id,
            siteUrl: stash.url,
            userId: appUserId,
            status: "connected",
            scores: stash.scores,
            faviconUrl: stash.facts?.faviconUrl,
            cms: stash.facts?.cms,
            findings: stash.findings,
            updatedAt: Date.now(),
          }),
          {
            access: "public",
            contentType: "application/json",
            addRandomSuffix: true // Generate unique filename for updates
          }
        );
        console.log("[saveSiteToDatabase] Blob storage updated");
      } catch (blobError) {
        // Blob update is optional, database is already updated
        console.warn("[saveSiteToDatabase] Blob update failed (non-critical):", blobError);
      }

      return existingSite.id;
    }

    // Create new site
    const siteId = crypto.randomUUID();
    console.log("[saveSiteToDatabase] Creating new site:", siteId);

    await db.insert(sites).values({
      id: siteId,
      siteUrl: stash.url,
      userId: appUserId,
      canonicalHost,
      canonicalRoot,
      status: "connected",
      cms: stash.facts?.cms?.type || null,
      lastScores: stash.scores ? JSON.stringify(stash.scores) : null,
      lastFaviconUrl: stash.facts?.faviconUrl || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // Save to blob storage for quick access (optional cache)
    try {
      const { put } = await import("@vercel/blob");
      const blobKey = `sites/${siteId}.json`;
      await put(
        blobKey,
        JSON.stringify({
          siteId,
          siteUrl: stash.url,
          userId: appUserId,
          status: "connected",
          scores: stash.scores,
          faviconUrl: stash.facts?.faviconUrl,
          cms: stash.facts?.cms,
          findings: stash.findings,
          createdAt: Date.now(),
        }),
        { access: "public", contentType: "application/json" }
      );
      console.log("[saveSiteToDatabase] Blob storage created");
    } catch (blobError) {
      // Blob creation is optional, database is already saved
      console.warn("[saveSiteToDatabase] Blob creation failed (non-critical):", blobError);
    }

    console.log("[saveSiteToDatabase] Site created successfully:", siteId);
    return siteId;
  } catch (error) {
    console.error("[saveSiteToDatabase] Error:", error);
    return null;
  }
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ stash?: string; u?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Get or create app user ID from Clerk ID
  // This syncs the Clerk user to our database on first visit
  const appUserId = await getOrCreateAppUserId();
  if (!appUserId) {
    console.error("[WelcomePage] Failed to get or create app user ID");
    redirect("/dashboard");
  }

  console.log("[WelcomePage] User synced, appUserId:", appUserId);

  const sp = await searchParams;
  const stashKey = sp?.stash;
  const stashUrl = sp?.u;

  console.log("[WelcomePage] Search params:", { stashKey, stashUrl });

  if (!stashKey && !stashUrl) {
    console.error("[WelcomePage] No stash key or URL provided, redirecting to dashboard");
    redirect("/dashboard/sites?first=1");
  }

  // Retrieve stash
  let stash: StashedTestResult | null = null;
  if (stashUrl) {
    console.log("[WelcomePage] Fetching stash from URL:", stashUrl);
    stash = await fetchStashViaUrl(stashUrl);
    console.log("[WelcomePage] Stash fetch result:", stash ? "SUCCESS" : "FAILED");
  } else if (stashKey) {
    const composed = buildPublicUrlFromKey(stashKey);
    console.log("[WelcomePage] Built public URL from key:", composed);
    if (composed) {
      stash = await fetchStashViaUrl(composed);
      console.log("[WelcomePage] Stash fetch result:", stash ? "SUCCESS" : "FAILED");
    }
  }

  if (!stash) {
    console.error("[WelcomePage] Failed to retrieve stash data, redirecting to dashboard");
    redirect("/dashboard/sites?first=1");
  }

  console.log("[WelcomePage] Stash retrieved successfully:", {
    url: stash.url,
    hasScores: !!stash.scores,
    findingsCount: stash.findings?.length || 0,
    hasFacts: !!stash.facts,
  });

  // Save site to database
  console.log("[WelcomePage] Saving site to database for user:", appUserId, "URL:", stash.url);
  const siteId = await saveSiteToDatabase(appUserId, stash);
  if (!siteId) {
    console.error("[WelcomePage] Failed to create site");
    redirect("/dashboard/sites?first=1");
  }

  console.log("[WelcomePage] Site created successfully:", siteId);

  // Extract quick wins from findings
  const quickWins = stash.findings
    .filter((f) => f.severity === "critical" || f.severity === "medium")
    .slice(0, 10)
    .map((f) => ({
      title: f.title,
      impact: f.severity === "critical" ? "critical" as const : "high" as const,
      effort: "low" as const, // Simplified for now
      scoreIncrease: 2,
    }));

  // Extract domain from URL
  const domain = new URL(stash.url).hostname;

  // Prepare data for client component
  const welcomeData = {
    url: stash.url,
    domain,
    faviconUrl: stash.facts?.faviconUrl || undefined,
    overallScore: stash.scores?.overall || 0,
    categoryScores: {
      performance: stash.scores?.perf,
      security: stash.scores?.sec,
      seo: stash.scores?.seo,
      accessibility: stash.scores?.a11y,
      wordpress: stash.facts?.cms?.type === "wordpress" ? stash.scores?.overall : undefined,
    },
    quickWinsCount: stash.quickWinsCount || quickWins.length,
    potentialScoreIncrease: stash.potentialScoreIncrease || quickWins.length * 2,
    quickWins,
    siteId,
  };

  console.log("[WelcomePage] Preparing welcomeData for client:");
  console.log("[WelcomePage] - URL:", welcomeData.url);
  console.log("[WelcomePage] - Domain:", welcomeData.domain);
  console.log("[WelcomePage] - SiteId:", welcomeData.siteId);
  console.log("[WelcomePage] - OverallScore:", welcomeData.overallScore);
  console.log("[WelcomePage] - QuickWinsCount:", welcomeData.quickWinsCount);
  console.log("[WelcomePage] - Full welcomeData:", JSON.stringify(welcomeData, null, 2));

  return <WelcomeClient data={welcomeData} />;
}
